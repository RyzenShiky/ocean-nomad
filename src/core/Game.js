import * as THREE from 'three';
import { createOcean, waveHeight, setFreezeFactor, setSeaLevelOffset, seaLevelOffset } from '../world/Ocean.js';
import { resolvePlayerTerrain, collectSolids } from '../world/WorldCollision.js';
import { Raft, CELL, DECK_Y } from '../raft/Raft.js';
import { Player } from '../player/Player.js';
import { DebrisManager } from '../world/DebrisManager.js';
import { Inventory, ITEM_DEFS } from '../gameplay/Inventory.js';
import { tickEngines, toggleAll, countPower, ENGINES } from '../sim/engines.js';
import { radioReading, countAntennas } from '../systems/RadioSystem.js';
import { on } from '../sim/bus.js';
import { skyState } from '../world/Sky.js';
import { SharkSim } from '../sim/shark.js';
import { CraftUI } from '../ui/CraftUI.js';
import { RadialBuild } from '../ui/RadialBuild.js';
import * as SaveSys from '../save/SaveSystem.js';
import { RECIPES } from '../gameplay/Recipes.js';
import { ViewModel } from '../player/ViewModel.js';
import { SurvivorAvatar } from '../player/SurvivorAvatar.js';
import { SharkAvatar } from '../player/SharkAvatar.js';
import { AudioBus } from '../audio/AudioBus.js';
import { createRng } from '../sim/rng.js';
import { CUR } from '../world/Current.js';
import { t, applyDom, setLang, getLang, onLang } from '../i18n/index.js';
import { DEBRIS_KINDS } from '../world/debrisKinds.js';
import { CHAIN, NOTES } from '../story/chain.js';
import { tickStation } from '../sim/stations.js';
import { createCropState, tickCrop } from '../sim/crops.js';
import { tickVitals } from '../sim/vitals.js';
import { TutorialSystem } from '../systems/TutorialSystem.js';
import { StorySystem } from '../systems/StorySystem.js';
import { WeatherSystem } from '../systems/WeatherSystem.js';
import { DisasterDirector } from '../systems/DisasterDirector.js';
import { DisasterVfx } from '../systems/DisasterVfx.js';
import { BuildSystem } from '../systems/BuildSystem.js';
import { HookSystem } from '../systems/HookSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { TouchControls } from '../input/TouchControls.js';
import { Net } from '../net/Net.js';
import { InputBinder } from './InputBinder.js';
import { SaveCoordinator } from './SaveCoordinator.js';
import { RemotePlayers } from '../net/RemotePlayers.js';
import { EelSim } from '../sim/eel.js';
import { GullSwarm } from '../sim/gull.js';
import { KrakenTentacle } from '../sim/kraken.js';

const FIXED_DT = 1 / 60;
const MAX_FRAME = 0.1;

export class Game {
  constructor(canvas, { caps, quality, renderCtx } = {}) {
    this.canvas = canvas;
    // Boot pipeline wiring (must be before _initRenderer / quality)
    this.caps = caps || {};
    this.qualityManager = quality || null;
    this.renderCtx = renderCtx || null;

    this.time = 0;
    this.acc = 0;
    this.last = performance.now();
    this.fps = 60;
    this.frames = 0;
    this.fpsTimer = 0;
    this.frameNo = 0;
    this._ema = 16.7;
    this._pr = this._prMax = Math.min(devicePixelRatio, 2);
    this.running = false;
    this.paused = false;
    this.invOpen = false;
    this._saveTimer = 0;

    this._skyColor = new THREE.Color(0x87b8d8);
    this._underColor = new THREE.Color(0x042030);
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2(0, 0);
    this._plane = new THREE.Plane();
    this._hit = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._m4 = new THREE.Matrix4();
    this._up = new THREE.Vector3(0, 1, 0);

    this._initRenderer();
    this._initScene();
    this._initWorld();
    this._initSky();
    this._initHook();
    this.shark = new SharkSim();
    this.eel = new EelSim();
    this.gulls = new GullSwarm();
    this.kraken = new KrakenTentacle();
    // Visual tentacle (simple dark cone — must be in scene)
    this._krakenMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 5.5, 7),
      new THREE.MeshStandardMaterial({
        color: 0x1a0f1f, roughness: 0.85,
        emissive: 0x2a1030, emissiveIntensity: 0.25
      })
    );
    this._krakenMesh.visible = false;
    this._krakenMesh.castShadow = true;
    this.scene.add(this._krakenMesh);
    this.sharkAvatar = new SharkAvatar(this.scene);
    this.ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.96, 0.1, CELL * 0.96),
      new THREE.MeshStandardMaterial({ color: 0x44ff66, transparent: true, opacity: 0.45, depthWrite: false })
    );
    this.ghostMesh.visible = false;
    this.raft.group.add(this.ghostMesh);
    this.buildRot = 0;
    this.storm = 0;
    this._diedOnce = false;
    this._floatingDrops = []; // 0..1 intensity
    this.overcast = 0;
    this.helmYaw = 0; // raft thrust heading
    this._radio = null; // disaster-driven cloud target 0..1
    this._overcast = 0; // smoothed
    this._freeze = 0;
    this.season = 'semi';
    this._diedOnce = false;
    this.disasterCount = 0;
    this.tutorialSeen = new Set();
    this.debugMode = false;
    this._rocks = []; // volcanic projectiles
    this.researched = new Set();
    this.knownRecipes = new Set(['plank', 'rope', 'axe', 'hammer', 'hook']);
    this.knownRecipes = new Set(['plank', 'rope', 'axe', 'hammer', 'hook']);
    this.cropStates = new Map();
    this.islands = [];
    this._initIslands();
    this.fish = { state: 'idle', t: 0 };
    this.viewModel = new ViewModel(this.camera);
    this.avatar = new SurvivorAvatar(this.scene);
    this.thirdPerson = false;
    // Waterline foam ring (child of raft)
    {
      const fg = new THREE.RingGeometry(CELL * 1.8, CELL * 2.4, 24);
      fg.rotateX(-Math.PI / 2);
      this.foam = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false
      }));
      this.foam.position.y = 0.02;
      this.raft.group.add(this.foam);
    }
    // Rain points
    {
      const n = 1200;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i*3] = (Math.random() - 0.5) * 40;
        pos[i*3+1] = Math.random() * 25;
        pos[i*3+2] = (Math.random() - 0.5) * 40;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xaaccff, size: 0.08, transparent: true, opacity: 0.6, depthWrite: false
      }));
      this.rain.visible = false;
      this.scene.add(this.rain);
    }
    this.audio = new AudioBus();
    this.rng = createRng(Date.now() & 0xffffffff);
    this.story = { step: 0, notes: [], opened: [] };
    this.storyIslands = [];
    this._initUI();
    try {
      applyDom();
      onLang(() => {
        applyDom();
        this._renderHotbar?.();
        this.craft?.refresh?.();
      });
    } catch (_) {}
    this._bind();
    this.tutorial = new TutorialSystem(this);
    this.storySys = new StorySystem(this);
    this.weather = new WeatherSystem(this);
    this.vfx = new DisasterVfx(this.scene);
    this.disasters = new DisasterDirector(this);
    this.build = new BuildSystem(this);
    this.hooks = new HookSystem(this);
    this.combat = new CombatSystem(this);
    this.touch = new TouchControls(this);
    this.inputs = new InputBinder();
    this.saves = new SaveCoordinator(this);
    this.net = new Net();
    this.remotes = new RemotePlayers(this.scene, this.raft);
    this._mpMode = false; // true when in multiplayer session
    // Firebase di-load hanya saat Buat/Gabung room (lihat Net.init)
    this._bindNet();
    document.getElementById('btn-ending-menu')?.addEventListener('click', () => {
      document.getElementById('ending-screen')?.classList.add('hidden');
      this._toMenu();
    });
    this._shakeT = 0;
    this._shakeAmp = 0;

    this._installCrashHandlers();
    this._lastDraw = 0;
    this._minFrameMs = 0;
    this._fogBase = 0.014;
    this._unsubQ = this.qualityManager?.onChange?.(s => this._onQualityChange(s));
    if (this.qualityManager) {
      this._onQualityChange(this.qualityManager.settings);
    } else {
      this._applyQuality(localStorage.getItem('driftbound:quality') || 'medium');
    }
    this._offerEmergencyRestore();
    requestAnimationFrame(t => this.frame(t));
  }


  _offerEmergencyRestore() {
    try {
      const raw = localStorage.getItem('driftbound:emergency');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !data._emergency) return;
      const when = data._crashAt ? new Date(data._crashAt).toLocaleString() : 'recent';
      console.info('[Ocean Nomad] emergency save available from', when, data._crashMsg);
      setTimeout(() => this._toast?.('⚠ Crash save found (' + when + '). Use Load Voyage.'), 800);
    } catch (_) { /* ignore */ }
  }

  _installCrashHandlers() {
    if (window.__driftboundCrashHooks) return;
    window.__driftboundCrashHooks = true;
    window.addEventListener('error', (e) => {
      console.error('[Ocean Nomad] window error', e.error || e.message);
      try { this._onCrash(e.error || e.message); } catch (_) {}
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('[Ocean Nomad] unhandledrejection', e.reason);
      try { this._onCrash(e.reason); } catch (_) {}
    });
  }

  /** Quality tiers for weaker GPUs */
  _applyQuality(level) {
    // Manual: setLevel emits onChange → _onQualityChange
    if (this.qualityManager) {
      this.qualityManager.setLevel(level);
      this._toast?.('Kualitas: ' + this.qualityManager.level + (this.qualityManager.auto ? ' · otomatis' : ''));
      return;
    }
    this.quality = level === 'low' ? 'low' : level === 'high' ? 'high' : 'medium';
    localStorage.setItem('driftbound:quality', this.quality);
  }

  _onQualityChange(s) {
    if (!s) return;
    this.quality = s.level;
    this._qualitySettings = s;
    try { localStorage.setItem('driftbound:quality', s.level); } catch (_) {}
    this._prMax = s.pixelRatioMax ?? 1.5;
    // FPS cap only when NOT auto (auto needs headroom to climb)
    this._minFrameMs = (s.fpsLimit && !s.auto) ? (1000 / s.fpsLimit) : 0;

    // Shadow map resolution (dispose old map)
    const sz = s.shadowMap || 1024;
    if (this.sun?.shadow && this.sun.shadow.mapSize.x !== sz) {
      this.sun.shadow.mapSize.set(sz, sz);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.needsUpdate = true;
    }

    // Renderer pixel ratio + shadow type
    if (this.renderCtx?.applyQuality) {
      this._pr = this.renderCtx.applyQuality(s, this.scene);
    } else if (this.renderer) {
      const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
      this._pr = Math.min(dpr, s.pixelRatioMax ?? 1.5) * (s.resolutionScale ?? 1);
      this.renderer.setPixelRatio(this._pr);
      this.renderer.setSize(innerWidth, innerHeight, false);
      this.renderer.shadowMap.enabled = s.shadows !== 'off';
      this.renderer.shadowMap.needsUpdate = true;
    }

    // Rain budget
    if (this.rain?.geometry) {
      this.rain.geometry.setDrawRange(0, Math.min(s.rain || 900, 1200));
    }

    // Ocean LOD
    this.ocean?.setDetail?.(s.ocean);

    // Debris density (force full in multiplayer for index sync)
    this.debris?.setDensity?.(this._mpMode ? 1 : (s.debris ?? 1));

    // Fog from viewDistance (keep camera.far high for sky dome)
    this._fogBase = 2 / Math.max(40, s.viewDistance || 140);
    this._applyFog(this._fogBase);

    document.querySelectorAll('.btn-quality').forEach(b => {
      const q = b.dataset.q;
      const active = s.auto ? q === 'auto' : q === s.level;
      b.setAttribute('aria-pressed', String(active));
    });
  }

  _applyFog(d) {
    if (this.scene?.fog) this.scene.fog.density = d;
    if (this.ocean?.setFog && this.scene?.fog) {
      this.ocean.setFog(this.scene.fog.color, d);
    }
  }

  _initRenderer() {
    if (this.renderCtx?.renderer) {
      this.renderer = this.renderCtx.renderer;
    } else {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas, antialias: true, powerPreference: 'high-performance'
      });
      this.renderer.setSize(innerWidth, innerHeight);
      this.renderer.setPixelRatio(this._pr);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this._exp || 1.05;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = this._skyColor.clone();
    this.scene.fog = new THREE.FogExp2(0x87b8d8, 0.012);
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 400);
    this.scene.add(this.camera); // ViewModel is a child of camera — must be in scene graph
    this.camera.layers.disable(SurvivorAvatar.BODY_LAYER); // FP: hide body
    this.ambient = new THREE.AmbientLight(0x6688aa, 0.5);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.55);
    this.sun.position.set(40, 80, 25);
    this._sunOff = this.sun.position.clone();
    this.sun.castShadow = true;
    // Body still casts shadow in first-person (camera hides BODY_LAYER)
    try { this.sun.shadow.camera.layers.enable(SurvivorAvatar.BODY_LAYER); } catch (_) {}
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 5;
    this.sun.shadow.camera.far = 200;
    this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -50;
    this.sun.shadow.camera.right = this.sun.shadow.camera.top = 50;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.add(new THREE.HemisphereLight(0x87CEEB, 0x3a5f3a, 0.35));
  }

  _initWorld() {
    this.ocean = createOcean(this.scene);
    this.raft = new Raft(this.scene);
    this.player = new Player(this.camera, this.canvas);
    this.player.bindInput();
    this.debris = new DebrisManager(this.scene);
    this.player.position.set(0.5, 1.2, 0.5);
  }


  _initSky() {
    this.hour = 9;
    this._sd = new THREE.Vector3();
    this._exp = 1.05;
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(300, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false,
        uniforms: {
          uH: { value: new THREE.Vector3() },
          uZ: { value: new THREE.Vector3() },
          uS: { value: new THREE.Vector3() },
          uSun: { value: new THREE.Vector3() },
          uSunVis: { value: 1 },
          uNight: { value: 0 },
          uCloudDark: { value: 0 }
        },
        vertexShader: `varying vec3 vD; void main(){ vD=position; vec4 c=(projectionMatrix*modelViewMatrix*vec4(position,1.0)); gl_Position=c.xyww; }`,
        fragmentShader: `
          uniform vec3 uH,uZ,uS,uSun; uniform float uSunVis,uNight,uCloudDark; varying vec3 vD;
          float hash(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
          void main(){
            vec3 d=normalize(vD);
            vec3 col=mix(uH,uZ,sqrt(clamp(d.y,0.0,1.0)));
            float s=max(dot(d,uSun),0.0);
            col+=uS*(pow(s,6000.0)*8.0+pow(s,12.0)*0.25)*uSunVis;
            float h=hash(floor(d*220.0));
            col+=vec3(step(0.9985,h)*(0.5+0.5*h)*smoothstep(0.03,0.2,d.y)*uNight);
            col=mix(col, vec3(0.35,0.37,0.40), clamp(uCloudDark,0.0,1.0));
            gl_FragColor=vec4(col,1.0);
          }`
      })
    );
    this.dome.renderOrder = -1;
    this.dome.frustumCulled = false;
    this.scene.add(this.dome);
  }

  _applySky(hour) {
    const a = 2 * Math.PI * (hour - 6) / 24;
    const sd = this._sd.set(Math.cos(a), Math.sin(a), 0.3).normalize();
    const e = sd.y;
    const st = skyState(e);
    const M = THREE.MathUtils;
    const vis = M.smoothstep(e, -0.03, 0.0);
    const night = 1 - M.smoothstep(e, -0.14, -0.02);
    const u = this.dome.material.uniforms;
    u.uH.value.set(...st.H);
    u.uZ.value.set(...st.Z);
    u.uS.value.set(...st.S);
    u.uSun.value.copy(sd);
    // Smooth disaster/storm overcast (clouds darken)
    const ocTarget = Math.max(this.storm || 0, this.overcast || 0);
    this._overcast = THREE.MathUtils.lerp(this._overcast || 0, ocTarget, 0.08);
    const oc = this._overcast;
    // Overcast darkens sun + grey clouds — NEVER hijack uNight (stars are night-only)
    u.uSunVis.value = vis * (1 - oc * 0.45);
    u.uNight.value = night;
    if (u.uCloudDark) u.uCloudDark.value = oc * 0.55;
    const dim = 1 - oc * 0.28;
    u.uH.value.set(st.H[0] * dim, st.H[1] * dim, st.H[2] * dim);
    u.uZ.value.set(st.Z[0] * dim, st.Z[1] * dim, st.Z[2] * dim);
    this._skyColor.setRGB(u.uH.value.x, u.uH.value.y, u.uH.value.z);
    this._sunOff.copy(sd).multiplyScalar(100);
    this.sun.color.setRGB(st.S[0], st.S[1], st.S[2]);
    this.sun.intensity = st.sunI * (1 - oc * 0.35);
    if (this.ambient) this.ambient.intensity = st.amb * (1 - oc * 0.2);
    const U = this.ocean.material.uniforms;
    if (U.uSunDir) U.uSunDir.value.copy(sd);
    if (U.uSunVis) U.uSunVis.value = vis * (1 - (this._overcast || 0) * 0.7);
    if (U.uSunCol) U.uSunCol.value.setRGB(st.S[0], st.S[1], st.S[2]);
    if (U.uSkyHorizon) U.uSkyHorizon.value.setRGB(st.H[0], st.H[1], st.H[2]);
    if (U.uSkyZenith) U.uSkyZenith.value.setRGB(st.Z[0], st.Z[1], st.Z[2]);
    if (U.uLight) U.uLight.value = st.amb * 0.9 + st.sunI * 0.35;
    this._exp = M.lerp(2.2, 1.05, M.smoothstep(e, -0.05, 0.3));
  }

  _initHook() {
    this.hook = {
      state: 'idle',
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      t: 0,
      power: 0,
      target: null
    };
    this.hookMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.7, roughness: 0.4 })
    );
    this.hookLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xd8c9a0 })
    );
    this.hookLine.frustumCulled = false;
    this.hookMesh.visible = this.hookLine.visible = false;
    this.scene.add(this.hookMesh, this.hookLine);
  }

  _initUI() {
    this.el = {
      prompt: document.getElementById('prompt'),
      slotName: document.getElementById('slot-name'),
      barHp: document.getElementById('bar-hp'),
      barHunger: document.getElementById('bar-hunger'),
      barThirst: document.getElementById('bar-thirst'),
      barStamina: document.getElementById('bar-stamina'),
      pos: document.getElementById('pos'),
      fps: document.getElementById('fps'),
      effects: document.getElementById('status-effects'),
      hud: document.getElementById('hud'),
      menu: document.getElementById('menu'),
      pause: document.getElementById('pause-menu'),
      death: document.getElementById('death-menu'),
      loading: document.getElementById('loading')
    };
    this.slotEls = [];
    for (let i = 0; i < 10; i++) this.slotEls.push(document.getElementById('slot-' + i));

    this.buildPiece = 'raft_cell';
    this.radial = new RadialBuild({
      onSelect: (id) => { this.buildPiece = id; this._toast(t('toast.build', { name: RECIPES[id]?.name || id })); }
    });
    SaveSys.migrateLegacy();
    this.activeSlot = SaveSys.getLastSlot();
    this.playTime = 0;
    this._pendingDelete = null;
    this._pendingOverwrite = null;

    this.craftUI = new CraftUI({
      getInventory: () => this.player.inventory,
      getGame: () => this,
      getKnown: () => this.knownRecipes,
      onHotbarChange: () => this._renderHotbar(),
      onBuildFloor: () => this.build.tryBuildFloor(),
      onPlaceStructure: (id) => this.build.placeStructure(id),
      onOpen: () => {
        this.invOpen = true;
        this.player.unlock();
      },
      onClose: () => {
        this.invOpen = false;
        if (this.running && !this.paused) this.audio?.resume();
    this.player.lock();
      },
      getResearched: () => this.researched
    });
  }

  _clearIslands() {
    for (const isl of this.islands || []) {
      try { this.scene.remove(isl.group); } catch (_) {}
    }
    this.islands = [];
  }

  _initIslands() {
    this._clearIslands();
    const R = () => (this.rng ? this.rng() : Math.random());
    for (let n = 0; n < 3; n++) {
      const g = new THREE.Group();
      const sandR = 6 + R() * 4;
      const sand = new THREE.Mesh(
        new THREE.CylinderGeometry(sandR, sandR + 1.5, 1.2, 12),
        new THREE.MeshStandardMaterial({ color: 0xc2b280 })
      );
      sand.position.y = -0.15;
      sand.receiveShadow = true;
      g.add(sand);
      const treePositions = [];
      const volcanic = n === 0;
      if (!volcanic) {
        for (let ti = 0; ti < 3; ti++) {
          const lx = (R() - 0.5) * sandR * 0.9;
          const lz = (R() - 0.5) * sandR * 0.9;
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.3, 3, 6),
            new THREE.MeshStandardMaterial({ color: 0x6b4423 })
          );
          trunk.position.set(lx, 1.4, lz);
          trunk.castShadow = true;
          g.add(trunk);
          const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(1.2, 6, 4),
            new THREE.MeshStandardMaterial({ color: 0x2d6a2d })
          );
          leaf.position.set(lx, 3.2, lz);
          g.add(leaf);
          treePositions.push({ lx, lz });
        }
      } else {
        const volcano = new THREE.Mesh(
          new THREE.ConeGeometry(5, 8, 12),
          new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.95 })
        );
        volcano.position.y = 4;
        volcano.castShadow = true;
        g.add(volcano);
        const glow = new THREE.Mesh(
          new THREE.ConeGeometry(1.2, 1.5, 8),
          new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.8 })
        );
        glow.position.y = 7.5;
        g.add(glow);
      }
      g.position.set((R() - 0.5) * 200, 0, (R() - 0.5) * 200);
      this.scene.add(g);
      this.islands.push({
        group: g,
        radius: sandR + 0.5,
        volcanoRadius: 5.2,
        treePositions,
        trees: treePositions.length,
        volcanic,
        eruptCd: volcanic ? 15 + R() * 20 : 0
      });
    }
  }

  /** Deterministic world for multiplayer — call after rng.setSeed(roomSeed) */
  rebuildWorldFromSeed(seed) {
    if (seed != null) this.rng.setSeed(seed >>> 0);
    this.debris?.setRng?.(this.rng);
    this._initIslands();
    this.debris?.resetAround({ x: 0, z: 0 });
    this.time = 0;
    this._hostRaftTarget = null;
  }



  _bind() {
    // Prefer tracked listeners (dispose on menu)
    const bind = (target, type, fn, opts) =>
      (this.inputs ? this.inputs.on(target, type, fn, opts) : target.addEventListener(type, fn, opts));

    bind(window, 'blur', () => {
      if (this.radial?.isOpen()) this.radial.close(false);
      this._freezeLook = false;
    });
    bind(window, 'resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    // Click canvas to re-lock pointer (fixes Esc unlock stuck)
    bind(this.canvas, 'click', () => {
      if (this.running && !this.paused && !this.invOpen && !this.player.isLocked) {
        this.player.lock();
      }
    });

    const mpEl = document.querySelector('.menu-mp');
    if (mpEl) {
      mpEl.hidden = false; // selalu tampil; tombol tetap bisa diklik
      const hint = document.getElementById('mp-config-hint');
      if (hint) hint.hidden = !!this.net?.configured;
    }
    document.getElementById('btn-play')?.addEventListener('click', () => this.start(false));
    document.getElementById('btn-mp-create')?.addEventListener('click', () => this._mpCreate());
    document.getElementById('btn-mp-join')?.addEventListener('click', () => this._mpJoin());
    document.getElementById('btn-mp-start')?.addEventListener('click', () => this._mpStartVoyage());
    document.getElementById('btn-mp-copy')?.addEventListener('click', () => {
      const c = document.getElementById('mp-code-display')?.textContent;
      if (c) navigator.clipboard?.writeText(c).then(() => this._toast(t('toast.codeCopied')));
    });
    document.getElementById('btn-mp-back')?.addEventListener('click', () => {
      this.net?.leave();
      this._mpMode = false;
      document.getElementById('mp-lobby')?.classList.add('hidden');
      document.getElementById('menu')?.classList.remove('hidden');
    });
    document.getElementById('btn-load')?.addEventListener('click', () => this._showSlots('load'));
    document.getElementById('btn-save')?.addEventListener('click', () => this._showSlots('save'));
    const vol = document.getElementById('vol-master');
    if (vol) {
      vol.value = String(Math.round((this.audio?.volumes?.master ?? 0.7) * 100));
      vol.addEventListener('input', () => {
        this.audio?.resume();
        this.audio?.setMaster(parseInt(vol.value, 10) / 100);
      });
    }
    document.getElementById('btn-mute')?.addEventListener('click', () => {
      this.audio?.resume();
      const m = !this.audio?.muted;
      this.audio?.setMuted(m);
      this._toast(m ? 'Suara mati' : 'Suara hidup');
    });
    document.querySelectorAll('.btn-quality').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.q === 'auto') {
          this.qualityManager?.setAuto(true);
          this._toast?.(t('toast.qualityAuto'));
        } else {
          this.qualityManager?.setAuto(false);
          this._applyQuality(btn.dataset.q);
        }
      });
    });
    document.getElementById('btn-slots-back')?.addEventListener('click', () => {
      document.getElementById('save-slots')?.classList.add('hidden');
      if (this.running) {
        this.el.pause?.classList.remove('hidden');
        this.viewModel?.setVisible(false);
      } else {
        this.el.menu?.classList.remove('hidden');
      }
    });
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      this.paused = false;
      this.el.pause.classList.add('hidden');
      this.viewModel?.setVisible(true);
      this.player.lock();
    });
    document.getElementById('btn-quit')?.addEventListener('click', () => this._toMenu());
    document.getElementById('btn-respawn')?.addEventListener('click', () => this.start(false));
    document.querySelectorAll('[data-lang]').forEach(b => {
      b.addEventListener('click', () => {
        setLang(b.dataset.lang);
        document.querySelectorAll('[data-lang]').forEach(x =>
          x.setAttribute('aria-pressed', String(x.dataset.lang === getLang())));
      });
      b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
    });

    // Continue / load button if present
    const cont = document.getElementById('btn-continue');
    if (cont) cont.addEventListener('click', () => {
      this.start(false);
      this.load(SaveSys.getLastSlot());
    });

    on('died', () => this._die());

    this.player.controls.addEventListener('unlock', () => {
      if (this.radial?.isOpen()) this.radial.close(false);
      this._freezeLook = false;
      if (this.running && !this.paused && !this.invOpen) {
        this.paused = true;
        this.el.pause?.classList.remove('hidden');
        this.viewModel?.setVisible(false);
      }
    });

    bind(document, 'keydown', e => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (!this.running) return;
        this.craftUI.toggle();
        return;
      }
      if (e.code === 'Escape' && this.craftUI.isOpen()) {
        e.preventDefault();
        this.craftUI.close();
        return;
      }
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.replace('Digit', ''), 10);
        if (this.radial?.isOpen()) {
          this.radial.pickNumber(n === 0 ? 10 : n);
        } else if (!this.invOpen) {
          this.player.inventory.select(n === 0 ? 9 : n - 1);
          this._renderHotbar();
        }
        return;
      }
      if (!this.running || this.paused || this.invOpen) return;
      if (e.code === 'KeyE') {
        if (this.build.tryDoor()) {}
        else if (this.storySys.tryCollectNote()) {}
        else if (!this.build.useStation()) this.combat.tryCollect();
      }
      if (e.code === 'KeyJ') this.storySys.toggleJournal();
      if (e.code === 'F3') {
        this.debugMode = !this.debugMode;
        document.getElementById('debug-overlay')?.classList.toggle('hidden', !this.debugMode);
        this._toast(this.debugMode ? 'Debug ON' : 'Debug OFF');
      }
      if (e.code === 'KeyV') {
        this.thirdPerson = !this.thirdPerson;
        this.avatar?.setThirdPerson(this.thirdPerson);
        if (this.thirdPerson) this.camera.layers.enable(SurvivorAvatar.BODY_LAYER);
        else this.camera.layers.disable(SurvivorAvatar.BODY_LAYER);
        this._toast(this.thirdPerson ? 'Kamera orang ketiga' : 'Kamera orang pertama');
      }
            if (e.code === 'KeyR') {
        this.buildRot = (this.buildRot + Math.PI / 2) % (Math.PI * 2);
        this.toast('toast.rotate', { deg: Math.round(this.buildRot * 180 / Math.PI) });
      }
      if (e.code === 'KeyQ' || e.code === 'KeyF') {
        this.player.inventory.useSelected(this.player);
        this._renderHotbar();
      }
    });

    // Item-dependent left click
    bind(document, 'contextmenu', e => e.preventDefault());
    bind(document, 'mousemove', e => {
      if (this.radial?.isOpen()) {
        this.radial.onMove(e.movementX, e.movementY);
        // undo pointer-lock look
        if (this._camQuat) this.camera.quaternion.copy(this._camQuat);
      }
    });
    bind(document, 'wheel', e => {
      if (this.radial?.isOpen()) {
        e.preventDefault();
        this.radial.scroll(e.deltaY > 0 ? 1 : -1);
      }
    }, { passive: false });
    bind(document, 'mousedown', e => {
      if (e.button === 0) this._lmbDown = true;
      if (e.button === 2) {
        if (!this.running || this.paused || this.invOpen) return;
        if (this.player.inventory.selectedSlot?.id === 'hammer') {
          this._camQuat = this.camera.quaternion.clone();
          this.radial.open(this.buildPiece);
          this._freezeLook = true;
        }
        return;
      }
      if (e.button !== 0) return;
      if (!this.running || this.paused || this.invOpen || !this.player.isLocked) return;
      const id = this.player.inventory.selectedSlot?.id;
      if (id === 'hammer') { this.viewModel?.swing(); this.audio?.swing(); this.build.tryBuildFloor(); }
      else if (id === 'axe' || id === 'axe_iron') { this.viewModel?.swing(); this.audio?.swing(); this.combat.tryAxe(id === 'axe_iron'); }
      else if (id === 'spear') { this.viewModel?.swing(); this.audio?.swing(); this.combat.trySpear(); }
      else if (id === 'hook' && this.hook.state === 'idle') {
        this.hook.state = 'charging';
        this.hook.power = 0;
      } else if (id === 'rod') {
        if (this.fish.state === 'idle') {
          this.fish.state = 'casting'; this.fish.t = 0; this.viewModel?.swing(); this._toast(t('toast.fishing'));
        } else if (this.fish.state === 'bite') {
          this.player.inventory.add('raw_fish', 1);
          this.fish.state = 'idle';
          this._toast(t('toast.fishCaught', { item: ITEM_DEFS.raw_fish?.name || 'raw_fish' })); this._renderHotbar();
        }
      }
    });
    bind(document, 'mouseup', e => {
      if (e.button === 0) this._lmbDown = false;
      if (e.button === 0 && this.hook.state === 'charging') this.hooks.throw();
    });

    this.slotEls.forEach((el, i) => {
      if (!el) return;
      el.style.pointerEvents = 'auto';
      el.addEventListener('click', e => {
        e.stopPropagation();
        this.player.inventory.select(i);
        this._renderHotbar();
        this._flashSlotName();
      });
    });

    bind(document, 'wheel', e => {
      if (!this.running || this.paused || this.invOpen) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      let s = this.player.inventory.selected + dir;
      if (s < 0) s = 9;
      if (s > 9) s = 0;
      this.player.inventory.select(s);
      this._renderHotbar();
      this._flashSlotName();
    }, { passive: true });

    setTimeout(() => {
      this.el.loading?.classList.add('hidden');
      this.el.menu?.classList.remove('hidden');
      const cont = document.getElementById('btn-continue');
      if (cont) cont.style.display = SaveSys.hasAnySave() ? '' : 'none';
    }, 300);
  }

  start(tryLoad) {
    this.el.menu?.classList.add('hidden');
    this.el.death?.classList.add('hidden');
    this.el.pause?.classList.add('hidden');
    this.craftUI?.hide();
    this.el.hud?.classList.remove('hidden');
    this.running = true;
    this.paused = false;
    this.invOpen = false;
    this.hook.state = 'idle';
    this.hour = 9;
    this.time = 0;

    // Reset world
    this.raft.resetToStarter();
    this.debris.resetAround({ x: 0, z: 0 });
    if (this.shark) this.shark.reset();
    this.stationStates = new Map();
    this.cropStates = new Map();
    this.researched = new Set();
    this.storm = 0;
    this._diedOnce = false;
    this._floatingDrops = [];
    this.raft.sailRaised = false;
    this.fish = { state: 'idle', t: 0 };
    this.days = 1;
    if (!tryLoad) this.storySys?.reset();

    this.player.position.set(0.5, 1.3, 0.5);
    this.player.prev.copy(this.player.position);
    this.player.velocity.set(0, 0, 0);
    this.player.health = 100;
    this.player.thirst = 100;
    this.player.hunger = 100;
    this.player.stamina = 100;
    this.player.oxygen = 100;
    this.player.dead = false;
    this.player.inventory = new Inventory();
    this.player.onGround = false;
    if (!tryLoad) this.tutorial?.reset();

    if (tryLoad) {
      if (!this.load()) {
        // no save — treat as new
      }
    }
    this._renderHotbar();
    this.storySys?.spawnNext();
    if (this._pendingLayout) {
      this._applyRaftLayout(this._pendingLayout);
      this._pendingLayout = null;
    } else if (this._mpMode && this.net && !this.net.isHost) {
      // late join may still receive raft_layout via listener
    }
    this.player.lock();
    this.touch?.setVisible(true);
  }

  _toMenu() {
    this.save();
    this.running = false;
    // Note: menu re-entry keeps global binders; full dispose only if rebinding
    this.touch?.setVisible(false);
    this.touch?.setVisible(false);
    this.paused = false;
    this.invOpen = false;
    this.el.pause?.classList.add('hidden');
    this.el.death?.classList.add('hidden');
    this.craftUI?.hide();
    this.el.hud?.classList.add('hidden');
    this.el.menu?.classList.remove('hidden');
    this.player.unlock();
  }

  _die() {
    if (this._diedOnce) return;
    this._diedOnce = true;
    // Drop non-tool inventory at death location (Valheim-style)
    const keep = new Set(['hammer', 'hook']);
    const drops = [];
    for (let i = 0; i < this.player.inventory.slots.length; i++) {
      const s = this.player.inventory.slots[i];
      if (s && !keep.has(s.id)) {
        drops.push({ id: s.id, count: s.count || 1 });
        this.player.inventory.slots[i] = null;
      }
    }
    if (drops.length) {
      this._floatingDrops = this._floatingDrops || [];
      const pos = this.player.position.clone();
      for (const d of drops) {
        this._floatingDrops.push({
          id: d.id, count: d.count,
          x: pos.x + (Math.random() - 0.5) * 2,
          y: pos.y, z: pos.z + (Math.random() - 0.5) * 2,
          life: 300
        });
      }
      this._toast(t('toast.deathDrop'), 4000);
    }
    this._renderHotbar();
    this.running = false;
    this.invOpen = false;
    this.player.unlock();
    this.craftUI?.hide();
    this.el.death?.classList.remove('hidden'); // death UI
  }

  _tickFloatingDrops(dt) {
    if (!this._floatingDrops?.length) return;
    const p = this.player.position;
    for (let i = this._floatingDrops.length - 1; i >= 0; i--) {
      const d = this._floatingDrops[i];
      d.life -= dt;
      const dist = Math.hypot(d.x - p.x, d.z - p.z);
      if (dist < 2.0 && this.running && this.player.inventory.canAdd?.(d.id, 1)) {
        const left = this.player.inventory.add(d.id, d.count);
        if (left > 0) d.count = left;
        else {
          this._toast(t('toast.pickup', { item: ITEM_DEFS[d.id]?.name || d.id, n: d.count }));
          this._renderHotbar();
          this._floatingDrops.splice(i, 1);
        }
      } else if (d.life <= 0) {
        this._floatingDrops.splice(i, 1);
      }
    }
  }

  _showEnding() {
    this.paused = true;
    this.running = false;
    this.player.unlock();
    const el = document.getElementById('ending-screen');
    if (!el) {
      this._toast('🏁 Pelabuhan terakhir — perjalanan selesai!', 6000);
      return;
    }
    el.classList.remove('hidden');
    const dist = Math.hypot(this.raft.position.x, this.raft.position.z) | 0;
    const cells = this.raft.cells?.size || 0;
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
    set('end-days', String(this.days || 1));
    set('end-dist', dist + ' m');
    set('end-cells', String(cells));
    set('end-disasters', String(this.disasterCount || 0));
    set('end-time', Math.floor((this.playTime || 0) / 60) + ' min');
  }

  // ----- Save / Load -----

  _showSlots(mode) {
    this._slotMode = mode;
    this._pendingDelete = null;
    this._pendingOverwrite = null;
    this.el.menu?.classList.add('hidden');
    this.el.pause?.classList.add('hidden');
    const panel = document.getElementById('save-slots');
    const title = document.getElementById('slots-title');
    const list = document.getElementById('slot-list');
    if (title) title.textContent = mode === 'save' ? 'Save Voyage' : 'Load Voyage';
    if (!list) return;
    list.innerHTML = '';
    for (const s of SaveSys.listSlots()) {
      const row = document.createElement('div');
      row.className = 'slot-row';
      let meta = 'Empty slot';
      if (!s.empty) {
        const d = new Date(s.t);
        const when = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        meta = `Day ${s.day} · ${s.cells} floors · ${when}`;
      }
      const info = document.createElement('div');
      info.className = 'slot-info';
      info.innerHTML = `<b>Slot ${s.slot}</b><div class="meta">${meta}</div>`;
      row.appendChild(info);

      const go = document.createElement('button');
      go.textContent = mode === 'save' ? (s.empty ? 'Save' : 'Overwrite') : (s.empty ? 'Empty' : 'Load');
      go.disabled = mode === 'load' && s.empty;
      go.addEventListener('click', () => {
        if (mode === 'load') {
          this.start(false);
          if (this.load(s.slot)) this._toast(t('toast.slotLoaded', { n: s.slot }));
          else this._toast(t('toast.loadFail'));
          panel?.classList.add('hidden');
        } else {
          if (!s.empty && this._pendingOverwrite !== s.slot) {
            this._pendingOverwrite = s.slot;
            go.textContent = 'Sure?';
            go.classList.add('btn-confirm');
            this._toast(t('toast.confirmOverwrite'));
            setTimeout(() => {
              if (this._pendingOverwrite === s.slot) {
                this._pendingOverwrite = null;
                go.textContent = 'Overwrite';
                go.classList.remove('btn-confirm');
              }
            }, 3000);
            return;
          }
          this.save(s.slot);
          panel?.classList.add('hidden');
          if (this.running) {
            this.paused = false;
            this.player.lock();
          }
        }
      });
      row.appendChild(go);

      if (!s.empty) {
        const del = document.createElement('button');
        del.className = 'btn-del';
        del.textContent = 'Delete';
        del.addEventListener('click', () => {
          if (this._pendingDelete !== s.slot) {
            this._pendingDelete = s.slot;
            del.textContent = 'Sure?';
            del.classList.add('btn-confirm');
            setTimeout(() => {
              if (this._pendingDelete === s.slot) {
                this._pendingDelete = null;
                del.textContent = 'Delete';
                del.classList.remove('btn-confirm');
              }
            }, 3000);
            return;
          }
          SaveSys.deleteSlot(s.slot);
          this._showSlots(mode);
        });
        row.appendChild(del);
      } else {
        const spacer = document.createElement('span');
        spacer.style.minWidth = '72px';
        row.appendChild(spacer);
      }
      list.appendChild(row);
    }
    panel?.classList.remove('hidden');
  }

  _serialize() {
    const p = this.player, inv = p.inventory;
    const chests = [];
    for (const [k, pr] of this.raft.props) {
      if (pr.inv) chests.push([k, pr.inv]);
    }
    const stations = [...(this.stationStates || [])].map(([k, s]) => [k, { ...s }]);
    const crops = [...(this.cropStates || [])].map(([k, c]) => [k, { ...c }]);
    const edges = [...this.raft.edges.entries()].map(([k, e]) => [k, e.type, !!e.open]);
    const pl = this.raft.group.worldToLocal(p.position.clone());
    return {
      v: 2,
      t: Date.now(),
      days: this.days || 1,
      playTime: this.playTime || 0,
      hour: this.hour,
      inv: inv.slots,
      sel: inv.selected,
      stats: [p.health, p.thirst, p.hunger, p.stamina],
      pl: [pl.x, pl.y, pl.z],
      raft: {
        p: this.raft.position.toArray(),
        q: this.raft.quaternion.toArray()
      },
      cells: [...this.raft.cells],
      props: [...this.raft.props.entries()].map(([k, v]) => [k, v.id, v.rotY || 0]),
      edges,
      chests,
      stations,
      crops,
      researched: [...(this.researched || [])],
      knownRecipes: [...(this.knownRecipes || [])],
      sail: !!this.raft.sailRaised,
      story: {
        step: this.story?.step || 0,
        notes: [...(this.story?.notes || [])],
        opened: [...(this.story?.opened || [])],
        islands: (this.storyIslands || []).map(s => ({
          i: s.chainIndex,
          x: s.group.position.x,
          z: s.group.position.z,
          c: !!s.collected
        }))
      }
    };
  }

  save(slot) {
    if (!this.running) return false;
    const n = slot || this.activeSlot || SaveSys.getLastSlot();
    const ok = SaveSys.saveSlot(n, this._serialize());
    this.activeSlot = n;
    this._toast(ok ? `Saved slot ${n}` : 'Save failed');
    return ok;
  }

  load(slot) {
    const n = slot || this.activeSlot || SaveSys.getLastSlot();
    const s = SaveSys.loadSlot(n);
    if (!s || (s.v !== 1 && s.v !== 2)) return false;
    this.activeSlot = n;

    this.raft.resetToStarter();
    this.raft.cells.clear();
    this.raft.cellKeys = [];
    this.raft.cellInst.count = 0;
    if (this.raft.hullInst) this.raft.hullInst.count = 0;
    this.raft.mass = 0;
    for (const [, pr] of [...this.raft.props]) {
      this.raft.group.remove(pr.mesh);
    }
    this.raft.props.clear();
    for (const e of this.raft.edges.values()) this.raft.group.remove(e.mesh);
    this.raft.edges.clear();

    for (const k of s.cells || []) {
      const [i, j] = k.split(',').map(Number);
      this.raft.addCell(i, j, false);
    }
    if (this.raft.cells.size === 0) {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) this.raft.addCell(i, j, false);
    }
    this.raft._rebuildBuoyancy();

    // Restore raft pose BEFORE player
    if (s.raft?.p) {
      this.raft.position.fromArray(s.raft.p);
      this.raft.prevPos.copy(this.raft.position);
    }
    if (s.raft?.q) {
      this.raft.quaternion.fromArray(s.raft.q);
      this.raft.prevQuat.copy(this.raft.quaternion);
    }
    this.raft.group.quaternion.copy(this.raft.quaternion);
    this.raft.group.position.copy(this.raft.position).sub(
      this.raft.com.clone().applyQuaternion(this.raft.quaternion)
    );
    this.raft.group.updateMatrixWorld(true);

    for (const row of s.props || []) {
      const k = row[0], id = row[1], rot = row[2] || 0;
      if (String(k).endsWith(':roof')) {
        const [i, j] = String(k).replace(':roof', '').split(',').map(Number);
        this.raft.placeRoof(i, j);
      } else {
        const [i, j] = String(k).split(',').map(Number);
        this.raft.placeProp(i, j, id, rot);
      }
    }

    // Edges + door open per key
    for (const row of s.edges || []) {
      const k = row[0], type = row[1], open = !!row[2];
      const parts = String(k).split(',').map(Number);
      const [i, j, d] = parts;
      this.raft.placeEdge(i, j, d, type);
      const e = this.raft.edges.get(k) || this.raft.edges.get(this.raft.edgeKey(i, j, d));
      if (e && open) { e.open = true; e.t = 1; if (e.mesh) e.mesh.rotation.y = (e.baseRot || 0) - Math.PI / 2 * 0.95; }
    }

    this.stationStates = new Map();
    for (const [k, st] of s.stations || []) this.stationStates.set(k, st);
    this.cropStates = new Map();
    for (const [k, c] of s.crops || []) this.cropStates.set(k, c);
    for (const [k, invData] of s.chests || []) {
      const pr = this.raft.props.get(k);
      if (pr) pr.inv = invData;
    }

    const p = this.player;
    p.inventory.slots = Inventory.fit(s.inv);
    p.inventory.selected = s.sel ?? 0;
    const st = s.stats || [100, 100, 100, 100];
    p.health = st[0]; p.thirst = st[1]; p.hunger = st[2];
    if (st[3] != null) p.stamina = st[3];

    // Player in raft-local coords
    if (s.pl) {
      p.position.copy(this.raft.group.localToWorld(new THREE.Vector3().fromArray(s.pl)));
    } else if (s.pos) {
      p.position.set(s.pos[0], s.pos[1], s.pos[2]);
    } else {
      p.position.set(0.5, 1.3, 0.5);
      this.raft.group.localToWorld(p.position);
    }
    p.prev.copy(p.position);

    if (s.researched) this.researched = new Set(s.researched);
    if (s.knownRecipes) this.knownRecipes = new Set(s.knownRecipes);
    if (s.hour != null) this.hour = s.hour;
    this.days = s.days || 1;
    this.playTime = s.playTime || 0;
    this.raft.sailRaised = !!s.sail;

    // Story islands
    for (const si of this.storyIslands || []) this.scene.remove(si.group);
    this.storyIslands = [];
    if (s.story) {
      this.story = {
        step: s.story.step || 0,
        notes: s.story.notes || [],
        opened: s.story.opened || []
      };
      for (const isl of s.story.islands || []) {
        this.storySys.spawnAt(isl.i, isl.x, isl.z, isl.c);
      }
    } else {
      this.story = { step: 0, notes: [], opened: [] };
    }
    if (!this.storyIslands.some(s => !s.collected)) {
      this.storySys.spawnNext();
    }

    this._renderHotbar();
    return true;
  }

  // ----- Deck hit in local raft space -----


  _eruptRocks(origin, distToRaft) {
    if (!this._rocks) this._rocks = [];
    const n = 12 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.25 + Math.random() * 0.35, 5, 4),
        new THREE.MeshStandardMaterial({
          color: Math.random() < 0.4 ? 0xff3300 : 0x333333,
          emissive: Math.random() < 0.4 ? 0xff2200 : 0x000000,
          emissiveIntensity: 0.6,
          roughness: 0.9
        })
      );
      const ox = origin.x ?? origin.position?.x ?? 0;
      const oy = (origin.y ?? origin.position?.y ?? 0) + 6;
      const oz = origin.z ?? origin.position?.z ?? 0;
      mesh.position.set(ox, oy, oz);
      const speed = 4 + Math.random() * 8;
      const toRaft = new THREE.Vector3(
        this.raft.position.x - ox,
        0,
        this.raft.position.z - oz
      );
      if (toRaft.lengthSq() > 1) toRaft.normalize();
      else {
        const ang = Math.random() * Math.PI * 2;
        toRaft.set(Math.cos(ang), 0, Math.sin(ang));
      }
      const vel = new THREE.Vector3(
        toRaft.x * speed * (0.5 + Math.random()),
        6 + Math.random() * 8,
        toRaft.z * speed * (0.5 + Math.random())
      );
      this.scene.add(mesh);
      this._rocks.push({ mesh, vel, life: 8 });
    }
    this._shakeCamera(0.35, 1.2);
  }

  _tickRocks(dt) {
    if (!this._rocks?.length) return;
    for (let i = this._rocks.length - 1; i >= 0; i--) {
      const r = this._rocks[i];
      r.vel.y -= 9.8 * dt;
      r.mesh.position.x += r.vel.x * dt;
      r.mesh.position.y += r.vel.y * dt;
      r.mesh.position.z += r.vel.z * dt;
      r.life -= dt;
      const wy = waveHeight(r.mesh.position.x, r.mesh.position.z, this.time);
      if (r.mesh.position.y <= wy + 0.2 || r.life <= 0) {
        const local = r.mesh.position.clone();
        this.raft.group.worldToLocal(local);
        const ci = Math.round(local.x / CELL);
        const cj = Math.round(local.z / CELL);
        const key = this.raft.cellKey ? this.raft.cellKey(ci, cj) : (ci + ',' + cj);
        if (this.raft.cells?.has(key) && this.raft.cells.size > 1) {
          if (this.raft.removeCell) this.raft.removeCell(ci, cj);
          this._toast('🔥 Lava merusak lantai!', 1800);
        }
        const pd = Math.hypot(
          r.mesh.position.x - this.player.position.x,
          r.mesh.position.z - this.player.position.z
        );
        if (pd < 2.2) {
          this.player.health = Math.max(0, this.player.health - 12);
          this._toast('🔥 Tertimpa batu panas!', 1500);
          this.audio?.hit?.();
        }
        this.scene.remove(r.mesh);
        try { r.mesh.geometry?.dispose?.(); r.mesh.material?.dispose?.(); } catch (_) {}
        this._rocks.splice(i, 1);
      }
    }
  }



  /** Client: apply host disaster phase visuals (no simulation authority). */
  _onMpDisasterPhase(d) {
    if (!d || this.net?.isHost) return;
    const type = d.type || '';
    const state = d.state || '';
    this._mpDisaster = d;
    // Soft overcast targets by phase (host still sends overcast each tick)
    const oc = {
      WARNING: 0.3, DRAWBACK: 0.55, SURGE: 1, IMPACT: 1, RECEDE: 0.4,
      active: 0.7, circling: 0.2
    };
    if (state in oc) this.overcast = Math.max(this.overcast || 0, oc[state]);
    if (type === 'superstorm' || type === 'storm') {
      this.storm = Math.max(this.storm || 0, 0.65);
      this.overcast = Math.max(this.overcast || 0, 0.7);
    }
    // One-shot feedback per phase change
    const key = type + ':' + state;
    if (this._lastMpDisasterKey === key) return;
    this._lastMpDisasterKey = key;
    const msgs = {
      'tsunami:WARNING': '🌊 Air laut terasa aneh...',
      'tsunami:DRAWBACK': '⚠️ Air SURUT — tsunami!',
      'tsunami:SURGE': '🌊 Gelombang raksasa!',
      'tsunami:IMPACT': '💥 Tsunami menghantam!',
      'tsunami:RECEDE': 'Air mulai surut...',
      'seaquake:active': '🌋 Getaran bawah laut...',
      'superstorm:active': '🌪 Badai super!',
      'volcano:active': '🌋 Gunung api meletus!',
      'shipwreck:active': '🚢 Bangkai kapal muncul...',
      'tornado:active': '🌪 Tornado mendekat!'
    };
    const msg = msgs[key] || (type ? `⚠ ${type} — ${state}` : null);
    if (msg) this._toast(msg, 3200);
    if (type === 'seaquake' || state === 'IMPACT') this._shakeCamera?.(0.45, 1.2);
    this.audio?.notify?.();
  }

  _bindNet() {
    const n = this.net;
    if (!n) return;
    n.on('build', (data) => {
      if (this.net.isHost) return;
      try {
        if (data?.piece === 'raft_cell' && data.i != null) this.raft.addCell(data.i, data.j);
        else if (data?.piece && data.i != null) this.raft.placeProp?.(data.i, data.j, data.piece, data.rot || 0);
      } catch (_) {}
    });
    n.on('host_left', () => {
      if (this.net?.isHost) return;
      this._toast('Host keluar — kembali ke menu', 4000);
      this._toMenu?.();
    });
    n.on('debris_sync', (list) => {
      if (this.net?.isHost || !Array.isArray(list) || !this.debris?.kinds) return;
      const cur = DEBRIS_KINDS.map(() => 0);
      for (const row of list) {
        const k = row[0], x = row[1], z = row[2];
        const name = DEBRIS_KINDS[k];
        const d = this.debris.kinds[name]?.list[cur[k]++];
        if (d) { d.x += (x - d.x) * 0.35; d.z += (z - d.z) * 0.35; }
      }
    });
    n.on('start', () => {
      if (this.net.isHost || this.running) return;
      document.getElementById('mp-lobby')?.classList.add('hidden');
      this.start(false);
    });
    n.on('world', (w) => {
      if (this.net.isHost || !w) return;
      if (w.raft && this.raft) {
        if (!this._hostRaftTarget) {
          this._hostRaftTarget = {
            pos: new THREE.Vector3(),
            quat: new THREE.Quaternion()
          };
        }
        this._hostRaftTarget.pos.set(w.raft[0], w.raft[1], w.raft[2]);
        if (w.raftQ) this._hostRaftTarget.quat.set(w.raftQ[0], w.raftQ[1], w.raftQ[2], w.raftQ[3]);
      }
      if (typeof w.time === 'number') this.time += (w.time - this.time) * 0.2;
      if (typeof w.storm === 'number') this.storm = w.storm;
      if (typeof w.hour === 'number') this.hour = w.hour;
      if (typeof w.sea === 'number') setSeaLevelOffset(w.sea);
      if (typeof w.overcast === 'number') this.overcast = w.overcast;
      if (w.disaster) {
        const prev = this._mpDisaster;
        this._mpDisaster = w.disaster;
        // One-shot toast/shake when phase changes
        if (!prev || prev.state !== w.disaster.state || prev.type !== w.disaster.type) {
          this._onMpDisasterPhase(w.disaster);
        }
      } else {
        this._mpDisaster = null;
      }
      if (this.shark && w.shark) {
        this.shark.x = w.shark[0]; this.shark.y = w.shark[1]; this.shark.z = w.shark[2];
        if (w.sharkS) this.shark.state = w.sharkS;
      }
      // Host debris positions → client snap (authoritative)
      if (Array.isArray(w.debris) && this.debris?.kinds) {
        const cur = DEBRIS_KINDS.map(() => 0);
        for (const row of w.debris) {
          const k = row[0], x = row[1], z = row[2];
          const name = DEBRIS_KINDS[k];
          const d = this.debris.kinds[name]?.list[cur[k]++];
          if (d) { d.x += (x - d.x) * 0.35; d.z += (z - d.z) * 0.35; }
        }
      }
      // Story islands for late join / clients
      if (Array.isArray(w.story) && this.storySys) {
        for (const s of w.story) {
          const exists = (this.storyIslands || []).some(si => si.chainIndex === s.chainIndex);
          if (!exists) this.storySys.spawnAt(s.chainIndex, s.x, s.z, !!s.collected);
          else {
            const si = this.storyIslands.find(x => x.chainIndex === s.chainIndex);
            if (si?.group) si.group.position.set(s.x, 0, s.z);
          }
        }
      }
    });
    n.on('build_result', (data) => {
      if (!data || this.net.isHost) return;
      this._applyRemoteBuild(data);
    });
    n.on('build_reject', (data) => {
      if (!data || this.net.isHost || data.to !== this.net.uid) return;
      this._rollbackClientBuild(data);
      this._toast(t('toast.hostReject'));
    });
    n.on('build_intent', (data, from) => {
      if (!this.net.isHost || !data) return;
      const ok = this._applyRemoteBuild(data);
      if (ok) {
        this.net.sendEvent('build_result', data);
        this._pushRaftLayout();
      } else {
        this.net.sendEvent('build_reject', { ...data, to: from });
      }
    });
    n.on('raft_layout', (layout) => {
      if (this.net.isHost || !layout) return;
      if (!this.running) {
        this._pendingLayout = layout;
        return;
      }
      this._applyRaftLayout(layout);
    });
    n.on('debris_take', (data, from) => {
      if (!data || from === this.net.uid) return;
      this.debris?.takeByIndex?.(data.list, data.index, this.raft?.position);
    });
    n.on('chest', (data, from) => {
      if (!data || !this.raft?.props || from === this.net.uid) return;
      const prop = this.raft.props.get(data.key);
      if (!prop) return;
      try {
        const inv = data.invJson != null
          ? JSON.parse(data.invJson)
          : data.inv;
        if (Array.isArray(inv)) {
          prop.inv = inv.map(s => (s ? { id: s.id, count: s.count || 1 } : null));
        }
      } catch (_) {}
    });
    n.on('story_spawn', (data) => {
      if (!data || this.net.isHost) return;
      if (!this.storyIslands) this.storyIslands = [];
      const exists = this.storyIslands.some(s => s.chainIndex === data.chainIndex);
      if (!exists) this.storySys?.spawnAt?.(data.chainIndex, data.x, data.z, !!data.collected);
    });
    n.on('story_note', (data) => {
      // Host advances story chain; each client keeps local note for own reward
      if (!data || !this.net.isHost) return;
      if (!this.story) this.story = { step: 0, notes: [], opened: [] };
      this.story.step = Math.max(this.story.step, (data.chainIndex || 0) + 1);
      this.storySys?.spawnNext();
    });
  }

  async _mpCreate() {
    const name = document.getElementById('mp-name')?.value?.trim() || 'Host';
    try {
      if (!this.net.connected) await this.net.init();
      const { code, seed } = await this.net.createRoom(name);
      this.rebuildWorldFromSeed(seed);
      this._mpMode = true;
      const disp = document.getElementById('mp-code-display');
      if (disp) disp.textContent = code;
      document.getElementById('mp-lobby')?.classList.remove('hidden');
      document.getElementById('menu')?.classList.add('hidden');
      const st = document.getElementById('mp-status');
      if (st) st.textContent = 'Room ' + code + ' — kamu host. Bagikan kode ke kru.';
      this._toast(t('toast.roomCreated', { code }));
    } catch (e) {
      console.error(e);
      this._toast(t('toast.roomFail'));
    }
  }

  async _mpJoin() {
    const name = document.getElementById('mp-name')?.value?.trim() || 'Crew';
    const code = document.getElementById('mp-code-input')?.value?.trim();
    if (!code) { this._toast(t('toast.enterCode')); return; }
    try {
      if (!this.net.connected) await this.net.init();
      const { seed } = await this.net.joinRoom(code, name);
      this.rebuildWorldFromSeed(seed);
      this._mpMode = true;
      const disp = document.getElementById('mp-code-display');
      if (disp) disp.textContent = code.toUpperCase();
      document.getElementById('mp-lobby')?.classList.remove('hidden');
      document.getElementById('menu')?.classList.add('hidden');
      const st = document.getElementById('mp-status');
      if (st) st.textContent = this.net.started
        ? 'Game sudah dimulai — masuk…'
        : ('Terhubung ke ' + code.toUpperCase() + ' — menunggu host');
      this._toast(t('toast.joined', { code: code.toUpperCase() }));
      if (this.net.started) {
        document.getElementById('mp-lobby')?.classList.add('hidden');
        this.start(false);
      }
    } catch (e) {
      console.error(e);
      this._toast(t('toast.joinFail'));
    }
  }

  _mpStartVoyage() {
    if (this._mpMode && this.net && !this.net.isHost) {
      this._toast(t('toast.waitHost'));
      return;
    }
    if (this._mpMode && this.net?.isHost) {
      this.net.markStarted?.();
      this.net.sendEvent('start', {});
    }
    document.getElementById('mp-lobby')?.classList.add('hidden');
    this.start(false);
    if (this._mpMode && this.net?.isHost) this._pushRaftLayout();
  }


  _applyRemoteBuild(d) {
    if (!d) return false;
    const r = this.raft;
    try {
      if (d.piece === 'raft_cell') {
        const key = `${d.i},${d.j}`;
        if (r.cells?.has?.(key)) return true;
        return !!r.addCell(d.i, d.j);
      }
      if (d.piece === 'roof') return !!r.placeRoof(d.i, d.j);
      if (d.edge) {
        if (r.hasEdge?.(d.i, d.j, d.d)) return true;
        return !!r.placeEdge(d.i, d.j, d.d, d.piece);
      }
      const key = `${d.i},${d.j}`;
      const ex = r.props?.get?.(key);
      if (ex) return (ex.id || ex) === d.piece; // same = idempotent, different = reject
      return !!r.placeProp(d.i, d.j, d.piece, d.rot || 0);
    } catch (_) { return false; }
  }

  _rollbackClientBuild(d) {
    if (!d) return;
    const r = this.raft;
    try {
      if (d.piece === 'raft_cell') r.removeCell?.(d.i, d.j);
      else if (d.edge) r.removeEdge?.(d.i, d.j, d.d);
      else if (d.piece === 'roof') r.removeRoof?.(d.i, d.j);
      else r.removePropAt?.(d.i, d.j);
    } catch (_) {}
    const req = (RECIPES[d.piece] && RECIPES[d.piece].requires) || {};
    for (const [id, n] of Object.entries(req)) this.player.inventory.add(id, n);
    this._renderHotbar();
  }

  _syncChest(prop, key) {
    if (!this._mpMode || !this.net?.code || !prop) return;
    const invJson = JSON.stringify(
      (prop.inv || []).map(s => (s ? { id: s.id, count: s.count || 1 } : null))
    );
    this.net.sendEvent('chest', { key, invJson });
    // Host also refreshes layout snapshot so late joiners get chests
    if (this.net.isHost) this._pushRaftLayout();
  }

  _pushRaftLayout() {
    if (!this._mpMode || !this.net?.isHost) return;
    const r = this.raft;
    const cells = [...(r.cells || [])];
    const props = [];
    if (r.props) {
      for (const [k, v] of r.props.entries()) {
        const invJson = Array.isArray(v.inv)
          ? JSON.stringify(v.inv.map(s => (s ? { id: s.id, count: s.count || 1 } : null)))
          : null;
        props.push([k, v.id || v, v.rotY || v.rot || 0, invJson]);
      }
    }
    const edges = [];
    if (r.edges) {
      for (const [k, e] of r.edges.entries()) {
        edges.push([k, e.type, !!e.open]);
      }
    }
    this.net.pushRaftLayout({ cells, props, edges, t: Date.now() });
  }

  _applyRaftLayout(L) {
    if (!L || !this.raft) return;
    const r = this.raft;
    try {
      for (const k of L.cells || []) {
        if (typeof k === 'string' && !r.cells.has(k)) {
          const [i, j] = k.split(',').map(Number);
          r.addCell(i, j);
        }
      }
      for (const row of L.props || []) {
        const k = row[0], id = row[1], rot = row[2] || 0, invRaw = row[3];
        const ks = String(k);
        if (ks.endsWith(':roof')) {
          if (!r.props?.has?.(k)) {
            const [i, j] = ks.replace(':roof', '').split(',').map(Number);
            r.placeRoof?.(i, j);
          }
        } else {
          if (!r.props?.has?.(k)) {
            const [i, j] = ks.split(',').map(Number);
            r.placeProp?.(i, j, id, rot);
          }
          const prop = r.props?.get?.(k);
          if (prop && invRaw != null) {
            try {
              const inv = typeof invRaw === 'string' ? JSON.parse(invRaw) : invRaw;
              if (Array.isArray(inv)) {
                prop.inv = inv.map(s => (s ? { id: s.id, count: s.count || 1 } : null));
              } else if (inv && typeof inv === 'object') {
                // RTDB may turn sparse arrays into objects
                const arr = [];
                for (const key of Object.keys(inv)) arr[Number(key)] = inv[key];
                prop.inv = arr.map(s => (s ? { id: s.id, count: s.count || 1 } : null));
              }
            } catch (_) {}
          }
        }
      }
      for (const row of L.edges || []) {
        const k = row[0], type = row[1];
        const parts = String(k).split(',').map(Number);
        if (parts.length >= 3) {
          const [i, j, d] = parts;
          if (!r.hasEdge?.(i, j, d)) r.placeEdge?.(i, j, d, type);
        }
      }
    } catch (err) {
      console.warn('[Ocean Nomad] applyRaftLayout', err);
    }
  }

  _shakeCamera(amp = 0.4, dur = 1) {
    this._shakeAmp = Math.max(this._shakeAmp || 0, amp);
    this._shakeT = Math.max(this._shakeT || 0, dur);
  }

  _applyImpulseToRaft(dir, strength = 10) {
    if (!this.raft?.velocity || !dir) return;
    const d = dir.clone ? dir.clone() : new THREE.Vector3(dir.x || 0, 0, dir.z || 0);
    if (d.lengthSq() < 1e-6) return;
    d.normalize();
    this.raft.velocity.x += d.x * strength;
    this.raft.velocity.z += d.z * strength;
    this.raft.angularVelocity.y += (Math.random() - 0.5) * strength * 0.08;
  }

  _applyWindForce(dir, strength = 5) {
    if (!this.raft?.velocity || !dir) return;
    const d = dir.clone ? dir.clone() : new THREE.Vector3(dir.x || 1, 0, dir.z || 0);
    if (d.lengthSq() < 1e-6) d.set(1, 0, 0);
    else d.normalize();
    // Gentle continuous push (called per frame with dt absorbed by caller as strength*dt-ish)
    this.raft.velocity.x += d.x * strength * 0.016;
    this.raft.velocity.z += d.z * strength * 0.016;
  }

  _flashSlotName() {
    const el = this.el?.slotName || document.getElementById('slot-name');
    if (!el) return;
    const item = this.player?.inventory?.selectedSlot;
    const name = item?.id ? (ITEM_DEFS[item.id]?.name ?? item.id) : '';
    if (!name) { el.classList.remove('show'); return; }
    el.textContent = name;
    el.classList.add('show');
    clearTimeout(this._slotNameT);
    this._slotNameT = setTimeout(() => el.classList.remove('show'), 1200);
  }


  nearbyChests(radius = 6) {
    const out = [];
    if (!this.raft?.props) return out;
    const pp = this.player.position;
    const rp = this.raft.position;
    const q = this.raft.quaternion;
    for (const [k, pr] of this.raft.props) {
      if (!pr.inv) continue;
      const [i, j] = k.split(',').map(Number);
      // world-ish distance: cell local + raft pos (approx)
      const lx = i * 1.5, lz = j * 1.5;
      const wx = rp.x + lx;
      const wz = rp.z + lz;
      if (Math.hypot(wx - pp.x, wz - pp.z) <= radius + 4) out.push(pr.inv);
    }
    return out;
  }

  _onCraftChestsChanged() {
    if (this._mpMode && this.net?.isHost) this._pushRaftLayout?.();
  }

  _tickEngines(dt) {
    if (this._mpMode && this.net && !this.net.isHost) return;
    if (!this.raft) return;
    const props = this.raft.props?.values?.() ? [...this.raft.props.values()] : [];
    const power = countPower(props);
    tickEngines(props, dt, this.helmYaw || 0, this.raft.velocity, power);
  }

  _tickRadio() {
    if (!this.raft) return;
    const props = this.raft.props ? [...this.raft.props.values()] : [];
    const hasRadio = props.some(p => p.id === 'radio_receiver');
    if (!hasRadio) {
      this._radio = null;
      return;
    }
    const ant = countAntennas(props);
    this._radio = radioReading(this.raft.position, this.storyIslands || [], ant);
  }

  _discoverRecipesFromInventory() {
    const inv = this.player?.inventory;
    if (!inv || !this.knownRecipes) return;
    for (const s of inv.slots) {
      if (!s) continue;
      for (const r of Object.values(RECIPES)) {
        if (r.requires && s.id in r.requires) this.knownRecipes.add(r.id);
      }
    }
  }

  toast(key, params, ms) {
    this._toast(t(key, params), ms);
  }

  giveItem(id, n = 1) {
    const left = this.player.inventory.add(id, n);
    if (left > 0) {
      const p = this.player.position;
      (this._floatingDrops ??= []).push({
        id, count: left,
        x: p.x + (Math.random() - 0.5) * 2,
        y: p.y, z: p.z + (Math.random() - 0.5) * 2,
        life: 300
      });
      this._toast(t('toast.invFullDropped'));
    }
    return left;
  }

  setPrompt(key, text) {
    const p = this.el?.prompt || document.getElementById('prompt');
    if (!p) return;
    if (!text) { p.hidden = true; return; }
    p.hidden = false;
    const kbd = p.querySelector('kbd');
    const span = p.querySelector('span');
    if (kbd) kbd.textContent = key || '';
    if (span) span.textContent = text;
  }

  _toast(msg, ms = 2200) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove('show'), ms);
  }



  _renderHotbar() {
    const inv = this.player.inventory;
    for (let i = 0; i < 10; i++) {
      const el = this.slotEls[i];
      if (!el) continue;
      const s = inv.slots[i];
      el.classList.toggle('selected', i === inv.selected);
      const icon = el.querySelector('.icon');
      const count = el.querySelector('.count');
      const key = el.querySelector('.key');
      if (s) {
        const def = ITEM_DEFS[s.id];
        if (icon) icon.textContent = def ? def.icon : '?';
        if (count) {
          count.textContent = s.count > 1 ? String(s.count) : '';
          count.style.display = s.count > 1 ? 'block' : 'none';
        }
      } else {
        if (icon) icon.textContent = '';
        if (count) { count.textContent = ''; count.style.display = 'none'; }
      }
      if (key) key.textContent = i === 9 ? '0' : String(i + 1);
    }
  }

  frame(now) {
    // Always reschedule first — a throw must not kill the loop forever
    requestAnimationFrame(t => this.frame(t));
    // FPS limiter only when manual quality (auto needs headroom to climb)
    if (this._minFrameMs && now - (this._lastDraw || 0) < this._minFrameMs - 1) return;
    this._lastDraw = now;
    try {
      this.frameNo++;
      this._ema += ((now - this.last) - this._ema) * 0.05;
      const dt = Math.min((now - this.last) / 1000, MAX_FRAME);
      this.last = now;
      this.acc += dt;
      this.frames++;
      this.fpsTimer += dt;
      if (this.fpsTimer >= 1) {
        this.fps = this.frames;
        this.frames = 0;
        this.fpsTimer = 0;
        if (this.running && !this.paused) this.qualityManager?.tickAuto?.(this.fps, 1);
      }

      // World keeps simulating while inventory open (only pause menu freezes)
      while (this.acc >= FIXED_DT) {
        if (this.running && !this.paused) this.sim(FIXED_DT);
        this.acc -= FIXED_DT;
      }

      this.render();
    } catch (err) {
      console.error('[Ocean Nomad] frame error', err);
      this._onCrash(err);
    }
  }

  /** Emergency autosave + toast; keeps loop alive */
  _onCrash(err) {
    const msg = (err && err.message) ? err.message : String(err);
    try {
      if (this.running && typeof this._serialize === 'function') {
        const data = this._serialize();
        data._emergency = true;
        data._crashAt = Date.now();
        data._crashMsg = msg.slice(0, 200);
        this.saves?.emergencySave?.(data);
      }
    } catch (e2) {
      console.warn('emergency save failed', e2);
    }
    try {
      this._toast?.('⚠ Error — progress disimpan darurat. Cek konsol.');
    } catch (_) { /* ignore */ }
    // Soft-recover: drop excess sim debt so we don't spiral
    this.acc = 0;
  }

  sim(dt) {
    this.time += dt;
    this.playTime = (this.playTime || 0) + dt;
    this._autoSaveAcc = (this._autoSaveAcc || 0) + dt;
    if (this._autoSaveAcc >= 90) {
      this._autoSaveAcc = 0;
      try {
        const n = SaveSys.getLastSlot();
        const r = SaveSys.saveSlot(n, this._serialize());
        if (r?.ok) { /* silent autosave */ }
      } catch (_) {}
    }
    const prevHour = this.hour || 0;
    this.hour = prevHour + dt * 24 / 720;
    if (this.hour >= 24) {
      this.days = (this.days || 1) + Math.floor(this.hour / 24);
      this.hour = this.hour % 24;
    }
    this.raft.loads.length = 0;
    if (this.player.onGround) {
      this.raft.loads.push({ pos: this.player.position, mass: 80 });
    }
    // Paddle / steer
    if (this.player.onGround) {
      const K = c => this.player.keys[c];
      if (K('KeyZ') || K('KeyX')) {
        // dayung: Z left, X right slight yaw force
        const side = (K('KeyZ') ? 1 : 0) + (K('KeyX') ? -1 : 0);
        this.raft.angularVelocity.y += side * 0.4 * dt;
        this.raft.velocity.x += Math.sin(this.raft.quaternion.y) * 0.3 * dt; // rough
      }
    }
    const isClient = this._mpMode && this.net && !this.net.isHost;
    if (!isClient) {
      this.raft.stepEdges?.(dt);
      this.raft.step(dt, this.time);
    } else if (this._hostRaftTarget) {
      const r = this.raft, k = 1 - Math.exp(-10 * dt);
      r.prevPos.copy(r.position);
      r.prevQuat.copy(r.quaternion);
      r.position.lerp(this._hostRaftTarget.pos, k);
      r.quaternion.slerp(this._hostRaftTarget.quat, k);
      r.delta.copy(r.position).sub(r.prevPos);
      r.stepEdges?.(dt);
      // applyRender(alpha) handles group + COM offset — do not copy group here
    }
    this.player.step(dt, this.raft, this.time, waveHeight);
    resolvePlayerTerrain(this.player, collectSolids(this));

    // Multiplayer pose (raft-local) + remote avatars
    if (this._mpMode && this.net?.code) {
      const local = this.player.position.clone();
      this.raft.group.worldToLocal(local);
      const yaw = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ').y;
      const spd = Math.hypot(this.player.velocity.x, this.player.velocity.z);
      this.net.sendPose(local, yaw, spd, this.player.health, performance.now());
      this.remotes?.update(this.net.peers, dt);
      if (this.net.isHost) {
        const debrisSnap = [];
        if (this.debris?.kinds) {
          for (const [k, name] of DEBRIS_KINDS.entries()) {
            for (const d of this.debris.kinds[name].list) {
              debrisSnap.push([k, +d.x.toFixed(1), +d.z.toFixed(1)]);
            }
          }
        }
        const storySnap = (this.storyIslands || []).map(s => ({
          chainIndex: s.chainIndex,
          x: +s.group.position.x.toFixed(1),
          z: +s.group.position.z.toFixed(1),
          collected: !!s.collected
        }));
        this.net.sendWorld({
          raft: [this.raft.position.x, this.raft.position.y, this.raft.position.z],
          raftQ: [this.raft.quaternion.x, this.raft.quaternion.y, this.raft.quaternion.z, this.raft.quaternion.w],
          time: this.time,
          storm: this.storm,
          hour: this.hour,
          sea: (typeof seaLevelOffset !== 'undefined' ? seaLevelOffset : 0),
          overcast: this.overcast || 0,
          disaster: this.disasters?.active
            ? { type: this.disasters.active.type, state: this.disasters.active.state, t: this.disasters.active.t || 0, phaseT: this.disasters.active.phaseT || 0 }
            : null,
          shark: this.shark ? [this.shark.x, this.shark.y, this.shark.z] : null,
          sharkS: this.shark?.state,
          story: storySnap
        }, performance.now());
        this.net.sendDebris(debrisSnap, performance.now());
      }
      // Crew HUD
      const crew = document.getElementById('crew-list');
      if (crew) {
        crew.textContent = '';
        const addRow = (name, hp, you) => {
          const row = document.createElement('div');
          row.className = 'crew-row' + (you ? ' you' : '');
          const dot = document.createElement('span');
          dot.className = 'dot on';
          const nm = document.createElement('span');
          nm.textContent = String(name || 'Crew').slice(0, 16);
          const em = document.createElement('em');
          em.textContent = String(Math.round(hp));
          row.append(dot, nm, em);
          crew.appendChild(row);
        };
        addRow(this.net.name || 'You', this.player.health, true);
        for (const c of this.remotes.list()) addRow(c.name, c.hp, false);
      }
      const ping = document.getElementById('conn-indicator');
      if (ping) ping.textContent = this.net.connected ? '● Online' : '○ Offline';
    }
    if (tickVitals(this.player, dt)) { /* death checked below */ }
    // Soft tutorial hints (first ~8 min)
    this.tutorial?.tick(dt);
    if (this.avatar) {
      // Yaw from camera euler — stable even when looking straight down
      const yaw = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ').y;
      const look = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const spd = Math.hypot(this.player.velocity.x, this.player.velocity.z);
      const sprint = !!(this.player.keys['ShiftLeft'] || this.player.keys['ShiftRight']);
      this.avatar.update(this.player.position, look, spd, sprint, dt);
    }
    this.debris.step(dt, this.time, this.raft.position);
    this.hooks.step(dt);
    if (this.shark && !(this._mpMode && this.net && !this.net.isHost)) {
      this.shark.step(dt, this.time, this.raft, waveHeight, this.player.position);
      if (this.shark.state === 'attack' && this._sharkWarn !== 'attack') {
        this._sharkWarn = 'attack';
        this._toast(t('toast.sharkAttack'), 2500);
        this.audio?.notify?.();
      } else if (this.shark.state === 'circle') {
        this._sharkWarn = 'circle';
      }
      if (this.shark.playerDamage > 0) {
        this.player.health = Math.max(0, this.player.health - this.shark.playerDamage);
        this._toast(t('toast.sharkBite')); this.audio?.hit?.();
      }
      if (this.sharkAvatar) {
        this.sharkAvatar.update(
          this.shark.x, this.shark.y, this.shark.z,
          this.shark.yaw, this.shark.state, dt
        );
      }
    }
    if (this.eel) {
      this.eel.step(dt, this.time, this.raft, waveHeight, this.player.position);
      if (this.eel.playerDamage) {
        this.player.health = Math.max(0, this.player.health - this.eel.playerDamage);
        this._toast('⚡ Belut listrik!', 1500);
      }
    }
    if (this.gulls) {
      const stole = this.gulls.step(dt, this.raft, this.player, this.invOpen);
      if (stole) {
        this._toast('🐦 Camar mencuri ' + stole + '!', 2500);
        this._renderHotbar();
      }
    }
    if (this.kraken) {
      if (this.kraken.trySpawn(this.storm || 0, this.raft)) {
        this._toast('🦑 Tentakel muncul dari ombak!', 3500);
        this._shakeCamera(0.5, 1.5);
        this.audio?.hit?.();
      }
      const kd = this.kraken.step(dt, this.raft, waveHeight, this.time);
      if (kd) {
        this.player.health = Math.max(0, this.player.health - kd);
        this._toast('🦑 Tentakel menghantam! (−15)', 2200);
        this._shakeCamera(0.7, 0.8);
        this.audio?.hit?.();
      }
      // Sync visual
      if (this._krakenMesh) {
        this._krakenMesh.visible = !!this.kraken.active;
        if (this.kraken.active) {
          this._krakenMesh.position.set(this.kraken.x, this.kraken.y + 1.5, this.kraken.z);
          // Point tip up when rising, thrash on slam
          const thrash = this.kraken.phase === 'slam' ? Math.sin(this.time * 20) * 0.35 : 0;
          this._krakenMesh.rotation.z = thrash;
          this._krakenMesh.rotation.x = this.kraken.phase === 'sink' ? 0.4 : -0.15;
        }
      }
    }
    if (this.stationStates) {
      for (const s of this.stationStates.values()) tickStation(s, dt);
    }
    if (this.cropStates) {
      for (const c of this.cropStates.values()) tickCrop(c, dt);
    }
    this.weather?.tick(dt);
    if (!(this._mpMode && this.net && !this.net.isHost)) this.disasters?.tick(dt);
    // Seasons from day count (3 days per season)
    this.season = ['semi', 'panas', 'gugur', 'dingin'][Math.floor((this.days || 1) / 3) % 4];
    const freezing = this.season === 'dingin';
    // Furnace / grill heat thaws ice near raft
    let heat = 0;
    if (this.stationStates) {
      for (const s of this.stationStates.values()) {
        if ((s.id === 'simple_grill' || s.id === 'smelter') && (s.fuel > 0 || s.cooking)) heat = Math.max(heat, 0.35);
      }
    }
    const freezeTarget = freezing ? Math.max(0, 1 - heat) : 0;
    this._freeze = THREE.MathUtils.lerp(this._freeze || 0, freezeTarget, Math.min(1, dt * 0.15));
    setFreezeFactor(this._freeze);
    this.ocean?.setFreeze?.(this._freeze);
    if (this.raft) this.raft.freezeFactor = this._freeze;

    // Islands drift with current + volcanic eruptions when near
    if (this.islands) {
      for (const isl of this.islands) {
        isl.group.position.x += CUR.x * 0.15 * dt;
        isl.group.position.z += CUR.z * 0.15 * dt;
        const dx = isl.group.position.x - this.raft.position.x;
        const dz = isl.group.position.z - this.raft.position.z;
        if (dx * CUR.x + dz * CUR.z > 180) {
          isl.group.position.x = this.raft.position.x - CUR.x * 120 + (this.rng() - 0.5) * 40;
          isl.group.position.z = this.raft.position.z - CUR.z * 120 + (this.rng() - 0.5) * 40;
          if (!isl.volcanic) isl.trees = 3;
        }
        if (isl.volcanic) {
          isl.eruptCd = (isl.eruptCd || 20) - dt;
          const distToRaft = Math.hypot(dx, dz);
          if (isl.eruptCd <= 0 && distToRaft < 60) {
            this._toast('🌋 Gunung berapi meletus!', 3000);
            this.audio?.hit?.();
            this._eruptRocks(isl.group.position, distToRaft);
            isl.eruptCd = 45 + Math.random() * 30;
          }
        }
      }
    }
    this._tickRocks(dt);
    this._tickEngines(dt);
    this._tickRadio();
    this._discoverRecipesFromInventory();
    this._tickFloatingDrops(dt);
    // Contextual tutorial near stations
    if (this.tutorialSeen && this.player?.onGround && this.raft?.props) {
      const local = this.player.position.clone();
      this.raft.group.worldToLocal(local);
      for (const [k, pr] of this.raft.props) {
        const [si, sj] = k.split(',').map(Number);
        const d = Math.hypot(si * CELL - local.x, sj * CELL - local.z);
        if (d > 3) continue;
        if (pr.id === 'research_table' && !this.tutorialSeen.has('research')) {
          this.tutorialSeen.add('research');
          this._toast('📘 Tekan E di meja riset untuk membuka resep baru');
        } else if (pr.id === 'simple_grill' && !this.tutorialSeen.has('grill')) {
          this.tutorialSeen.add('grill');
          this._toast('🔥 Grill: masukkan ikan mentah + papan (bahan bakar), E ambil hasil');
        } else if (pr.id === 'purifier' && !this.tutorialSeen.has('purifier')) {
          this.tutorialSeen.add('purifier');
          this._toast('⚗️ Purifier: air asin → air minum (butuh papan sebagai bahan bakar)');
        } else if (pr.id === 'crop_plot' && !this.tutorialSeen.has('crop')) {
          this.tutorialSeen.add('crop');
          this._toast('🪴 Kebun: tanam seed, tunggu panen, awasi burung!');
        }
      }
      if ((this._freeze || 0) > 0.5 && !this.tutorialSeen.has('ice')) {
        this.tutorialSeen.add('ice');
        this._toast('❄ Laut beku! Pakai kapak di dek atau nyalakan grill untuk mencairkan');
      }
    }

    // Collection net auto-pickup
    if (this.raft.props) {
      for (const [, pr] of this.raft.props) {
        if (pr.id !== 'net') continue;
        // treat any debris near raft
      }
    }
    if (this.debris && this.player.onGround) {
      const net = this.build.hasNet();
      if (net) {
        const got = this.debris.tryCollect(this.raft.position, { x: CUR.x, y: 0, z: CUR.z }, 8);
        if (got) {
          this.combat.giveLoot(got.type || got);
          if (this._mpMode && this.net?.code && got.index != null) {
            this.net.sendEvent('debris_take', { list: got.list === 'barrel' ? 'barrels' : (got.list || 'wood'), index: got.index });
          }
        }
      }
    }
    // Viewmodel
    if (this.viewModel) {
      const id = this.player.inventory.selectedSlot?.id;
      this.viewModel.setItem(['hammer', 'hook', 'axe', 'axe_iron', 'rod', 'spear'].includes(id) ? id : null);
      const moving = Math.hypot(this.player.velocity.x, this.player.velocity.z) > 0.5;
      this.viewModel.update(dt, moving);
    }
    // Wood creak occasionally
    if (this.rng() < 0.001) this.audio?.creak();
    // Fishing rod
    if (this.fish?.state === 'casting') {
      this.fish.t += dt;
      if (this.fish.t > 2 + Math.random() * 3) {
        this.fish.state = 'bite';
        this.fish.t = 0;
        this.toast('toast.bite');
      }
    } else if (this.fish?.state === 'bite') {
      this.fish.t += dt;
      if (this.fish.t > 1.2) {
        this.fish.state = 'idle';
        this.toast('toast.gotAway');
      }
    }

    if (this._spearCd > 0) this._spearCd = Math.max(0, this._spearCd - dt);


    this._saveTimer += dt;
    if (this._saveTimer > 60) {
      this._saveTimer = 0;
      this.save();
    }

    if (this.player.health <= 0) this._die();
  }

  render() {
    const alpha = this.acc / FIXED_DT;
    const pl = this.player;
    this.camera.position.lerpVectors(pl.prev, pl.position, alpha);
    this.camera.position.y += pl.height * 0.92;
    this.raft.applyRender(alpha);
    this.ocean.update(this.time, this.camera);
    if (this.dome) {
      this.dome.position.copy(this.camera.position);
      this._applySky(this.hour);
    }

    // Shadow every 2 frames, follow camera
    if ((this.frameNo & 1) === 0) this.renderer.shadowMap.needsUpdate = true;
    const c = this.camera.position;
    this.sun.target.position.set(Math.round(c.x / 2) * 2, 0, Math.round(c.z / 2) * 2);
    this.sun.position.copy(this.sun.target.position).add(this._sunOff);

    // Hook visual
    const on = this.hook.state !== 'idle' && this.hook.state !== 'charging';
    this.hookMesh.visible = this.hookLine.visible = on;
    if (on) {
      this.hookMesh.position.copy(this.hook.pos);
      const a = this.hookLine.geometry.attributes.position;
      a.setXYZ(0, this.camera.position.x, this.camera.position.y - 0.4, this.camera.position.z);
      a.setXYZ(1, this.hook.pos.x, this.hook.pos.y, this.hook.pos.z);
      a.needsUpdate = true;
    }

    const waterY = waveHeight(this.camera.position.x, this.camera.position.z, this.time);
    const underwater = this.camera.position.y < waterY - 0.05;
    if (underwater) {
      this.scene.background.copy(this._underColor);
      this.scene.fog.color.copy(this._underColor);
      this.scene.fog.density = 0.05;
      this.renderer.toneMappingExposure = (this._exp || 1.05) * 0.6;
      this.ocean.setFog(this._underColor, 0.05);
    } else {
      this.scene.background.copy(this._skyColor);
      this.scene.fog.color.copy(this._skyColor);
      this.scene.fog.density = 0.012;
      this.renderer.toneMappingExposure = this._exp || 1.05;
      this.ocean.setFog(this._skyColor, 0.012);
    }

    if ((this.frameNo & 7) === 0) {
      this.storySys?.updateCompass();
      this._updateHUD();
    }
    this.build?.updateGhost();
    // Storm lighting
    // Storm darkness handled by sky/lights/overcast — don't stack exposure
    const dw = document.getElementById('disaster-warn');
    if (dw) {
      const active = this.disasters?.active;
      if (active && !active.done) {
        const icons = {
          tsunami: '🌊 TSUNAMI', seaquake: '🌋 GEMPA', superstorm: '⛈️ BADAI',
          volcano: '🌋 LETUSAN', tornado: '🌪️ TORNADO', shipwreck: '🚢 BANGKAI'
        };
        dw.textContent = icons[active.type] || '⚠ BAHAYA';
        dw.classList.remove('hidden');
      } else {
        dw.classList.add('hidden');
      }
    }
    
    // Third-person camera rig
    if (this.thirdPerson && this.player) {
      const look = new THREE.Vector3();
      this.camera.getWorldDirection(look);
      look.y = 0;
      if (look.lengthSq() < 1e-6) look.set(0, 0, -1);
      else look.normalize();
      const back = look.clone().multiplyScalar(-3.2);
      back.y = 1.6;
      this.camera.position.copy(this.player.position).add(back);
      const tgt = this.player.position.clone();
      tgt.y += 1.2;
      this.camera.lookAt(tgt);
    } else if (this.player && !this.thirdPerson) {
      // FP: camera at eye height (controls already update orientation)
      this.camera.position.copy(this.player.position);
      this.camera.position.y += this.player.height * 0.92;
    }

    // Camera shake (disaster tremor)
    if (this._shakeT > 0) {
      this._shakeT -= 1 / 60;
      const a = (this._shakeAmp || 0.3) * Math.max(0, this._shakeT);
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a * 0.5;
      this.camera.position.z += (Math.random() - 0.5) * a;
      if (this._shakeT <= 0) this._shakeAmp = 0;
    }
    this.renderer.render(this.scene, this.camera);
  }

  _updateRadioCompass() {
    const el = document.getElementById('compass-arrow');
    if (!el) return;
    const r = this._radio;
    if (!r || r.signal <= 0) {
      el.style.opacity = '0.25';
      return;
    }
    const yaw = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ').y;
    const ang = (r.bearing - yaw) * (180 / Math.PI);
    el.style.transform = `rotate(${ang}deg)`;
    el.style.opacity = String(0.35 + r.signal * 0.65);
  }

  _updateHUD() {
    this._updateRadioCompass();
    const setLow = (id, pct) => {
      const el = document.getElementById(id);
      const row = el?.closest?.('.sbar');
      if (row) row.classList.toggle('low', pct < 25);
    };
    setLow('bar-hp', this.player?.health ?? 100);
    setLow('bar-hunger', this.player?.hunger ?? 100);
    setLow('bar-thirst', this.player?.thirst ?? 100);
    setLow('bar-stamina', this.player?.stamina ?? 100);

    const p = this.player;
    if (this.el.barHp) this.el.barHp.style.width = p.health + '%';
    if (this.el.barHunger) this.el.barHunger.style.width = p.hunger + '%';
    if (this.el.barThirst) this.el.barThirst.style.width = p.thirst + '%';
    if (this.el.barStamina) this.el.barStamina.style.width = p.stamina + '%';
    if (this.debugMode) {
      if (this.el.pos) {
        this.el.pos.textContent =
          `X:${p.position.x.toFixed(1)} Y:${p.position.y.toFixed(1)} Z:${p.position.z.toFixed(1)}`;
      }
      if (this.el.fps) this.el.fps.textContent = this.fps + ' FPS';
    }
    let fx = '';
    if (p.thirst < 25) fx += '⚠ Haus  ';
    if (p.hunger < 25) fx += '⚠ Lapar  ';
    if ((this._freeze || 0) > 0.35) fx += '❄ Laut beku  ';
    if (p.stamina < 12) fx += '⚠ Tired  ';
    if (p.oxygen < 40) fx += '⚠ Low O₂';
    if (this.hook.state === 'charging') fx += ` 🪝 ${Math.round(this.hook.power * 100)}%`;
    if (this.el.effects) this.el.effects.textContent = fx;
  
    const hint = document.getElementById('hint');
    if (hint) {
      const id = this.player?.inventory?.selectedSlot?.id;
      if (id === 'spear') hint.textContent = 'LMB: Tikam hiu (dekat) • V kamera';
      else if (id === 'hammer') hint.textContent = 'RMB menu bangun • LMB pasang • R putar';
      else if (id === 'axe' || id === 'axe_iron') hint.textContent = 'LMB: Bongkar / belah es';
      else if (id === 'hook') hint.textContent = 'Tahan LMB: Lempar kail';
      else if (id === 'rod') hint.textContent = 'LMB: Lempar pancing';
      else hint.textContent = 'Tab craft • RMB bangun • E interaksi • Esc simpan • V kamera';
    }
  }
}
