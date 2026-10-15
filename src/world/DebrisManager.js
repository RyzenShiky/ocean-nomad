import * as THREE from 'three';
import { Materials } from '../rendering/materials/Materials.js';
import { waveHeight } from './Ocean.js';
import { waveBatch, wasmActive } from '../wasm/engine.js';
import { CUR as CUR0 } from './Current.js';
import { DEBRIS, DEBRIS_KINDS } from './debrisKinds.js';

const CUR = new THREE.Vector3(CUR0.x, 0, CUR0.z);

function makeGeos() {
  const leafGeo = new THREE.PlaneGeometry(0.9, 0.35);
  leafGeo.rotateX(-Math.PI / 2);
  const bottle = new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8);
  bottle.rotateZ(Math.PI / 2);
  return {
    wood: new THREE.BoxGeometry(1.4, 0.12, 0.28),
    barrel: new THREE.CylinderGeometry(0.26, 0.28, 0.58, 8),
    plastic: bottle,
    scrap: new THREE.BoxGeometry(0.55, 0.05, 0.4),
    leaf: leafGeo,
    crate: new THREE.BoxGeometry(0.7, 0.5, 0.7)
  };
}

function makeMats() {
  return {
    wood: Materials.wood,
    barrel: Materials.barrel,
    crate: Materials.woodDark || Materials.wood,
    plastic: new THREE.MeshStandardMaterial({
      color: 0x8fc7d8, roughness: 0.25, transparent: true, opacity: 0.8
    }),
    scrap: new THREE.MeshStandardMaterial({
      color: 0x7a5a48, metalness: 0.6, roughness: 0.6
    }),
    leaf: new THREE.MeshStandardMaterial({
      color: 0x4f7d3a, roughness: 0.8, side: THREE.DoubleSide
    })
  };
}

export class DebrisManager {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.rng = Math.random.bind(Math);
    this._dummy = new THREE.Object3D();
    this._curN = CUR.clone().normalize();
    this._side = new THREE.Vector3(-this._curN.z, 0, this._curN.x);

    const geos = makeGeos();
    const mats = makeMats();
    this.kinds = {};
    for (const [name, def] of Object.entries(DEBRIS)) {
      const mesh = new THREE.InstancedMesh(geos[name], mats[name], def.count);
      mesh.castShadow = name === 'wood' || name === 'barrel' || name === 'crate';
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      const list = [];
      for (let i = 0; i < def.count; i++) list.push(this._spawn(55 + this._r() * 20));
      this.kinds[name] = { def, mesh, list };
    }
  }

  get wood() { return this.kinds.wood?.list || []; }
  get barrels() { return this.kinds.barrel?.list || []; }
  get woodMesh() { return this.kinds.wood?.mesh; }
  get barrelMesh() { return this.kinds.barrel?.mesh; }

  setRng(fn) {
    this.rng = typeof fn === 'function' ? fn : Math.random.bind(Math);
  }

  setDensity(f) {
    f = Math.max(0.05, Math.min(1, f));
    for (const { mesh, list } of Object.values(this.kinds)) {
      mesh.count = Math.max(1, Math.round(list.length * f));
    }
  }

  _r() { return this.rng(); }

  _spawn(radius) {
    const angle = this._r() * Math.PI * 2;
    const r = radius * (0.35 + this._r() * 0.65);
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      rot: this._r() * Math.PI * 2,
      spin: (this._r() - 0.5) * 0.4,
      phase: this._r() * Math.PI * 2,
      hooked: false
    };
  }

  _respawnUpstream(d, raftPos) {
    const len = Math.hypot(CUR.x, CUR.z) || 1;
    const fx = CUR.x / len, fz = CUR.z / len;
    const side = (this._r() - 0.5) * 80;
    d.x = raftPos.x - fx * (70 + this._r() * 40) + (-fz) * side;
    d.z = raftPos.z - fz * (70 + this._r() * 40) + fx * side;
    d.hooked = false;
    d.rot = this._r() * Math.PI * 2;
    d.phase = this._r() * Math.PI * 2;
  }

  _spawnAt(x, z, type = 'wood') {
    const list = this.kinds[type]?.list;
    if (!list?.length) return;
    const d = list[(this._r() * list.length) | 0];
    d.x = x;
    d.z = z;
    d.hooked = false;
  }

  resetAround(origin = { x: 0, z: 0 }) {
    for (const { list } of Object.values(this.kinds)) {
      for (const d of list) {
        const a = this._r() * Math.PI * 2;
        const r = 40 + this._r() * 50;
        d.x = origin.x + Math.cos(a) * r;
        d.z = origin.z + Math.sin(a) * r;
        d.hooked = false;
        d.rot = this._r() * Math.PI * 2;
      }
    }
  }

  nearest(pos, maxDist = 2) {
    let best = null, bd = maxDist * maxDist;
    for (const [type, { list }] of Object.entries(this.kinds)) {
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        if (d.hooked) continue;
        const q = (d.x - pos.x) ** 2 + (d.z - pos.z) ** 2;
        if (q < bd) { bd = q; best = { d, type, index: i }; }
      }
    }
    return best;
  }

  step(dt, time, raftPos) {
    this.time = time;
    if (!this._xzBuf) {
      this._xzBuf = new Float32Array(4096 * 2);
      this._hBuf = new Float32Array(4096);
    }
    for (const [name, k] of Object.entries(this.kinds)) {
      const { def, mesh, list } = k;
      const n = mesh.count;
      const len = list.length;
      for (let i = 0; i < len; i++) {
        const d = list[i];
        if (!d.hooked) {
          d.x += CUR.x * def.drift * dt;
          d.z += CUR.z * def.drift * dt;
          d.rot += d.spin * dt;
        }
        if (raftPos && Math.hypot(d.x - raftPos.x, d.z - raftPos.z) > 160) {
          this._respawnUpstream(d, raftPos);
        }
        this._xzBuf[i * 2] = d.x;
        this._xzBuf[i * 2 + 1] = d.z;
      }
      waveBatch(this._xzBuf, len, time, this._hBuf);
      for (let i = 0; i < len; i++) {
        const d = list[i];
        d.y = this._hBuf[i] + def.y + Math.sin(time * 1.5 + d.phase) * def.bob;
        if (i >= n) continue;
        this._dummy.position.set(d.x, d.y, d.z);
        this._dummy.rotation.set(0, d.rot, 0);
        this._dummy.updateMatrix();
        mesh.setMatrixAt(i, this._dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Microbench: 1000 batch runs */
  benchWave(samples = 64) {
    if (!this._xzBuf) {
      this._xzBuf = new Float32Array(4096 * 2);
      this._hBuf = new Float32Array(4096);
    }
    const n = Math.min(samples, 4096);
    for (let i = 0; i < n; i++) {
      this._xzBuf[i * 2] = (i % 16) * 3.1;
      this._xzBuf[i * 2 + 1] = (i % 11) * 2.7;
    }
    const t0 = performance.now();
    for (let k = 0; k < 1000; k++) waveBatch(this._xzBuf, n, k * 0.016, this._hBuf);
    const ms = performance.now() - t0;
    console.log(`[waveBatch] n=${n} x1000 ms=${ms.toFixed(1)} wasm=${wasmActive()}`);
    return ms;
  }

  tryCollect(playerPos, lookDir, maxDist = 4.5) {
    let best = null, bd = maxDist;
    for (const [type, { list }] of Object.entries(this.kinds)) {
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        if (d.hooked) continue;
        const dx = d.x - playerPos.x, dz = d.z - playerPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > maxDist || dist >= bd) continue;
        if (lookDir) {
          const lx = lookDir.x, lz = lookDir.z;
          const len = Math.hypot(lx, lz) || 1;
          const dot = (dx * lx + dz * lz) / (dist * len);
          if (dot < 0.35) continue;
        }
        bd = dist;
        best = { type, index: i, data: d };
      }
    }
    if (!best) return null;
    this._respawnUpstream(best.data, playerPos);
    return { type: best.type, index: best.index };
  }

  takeByIndex(listName, index, raftPos) {
    // listName: kind key or legacy 'wood'/'barrels'
    const key = listName === 'barrels' ? 'barrel' : listName;
    const d = this.kinds[key]?.list[index];
    if (!d) return false;
    this._respawnUpstream(d, raftPos || { x: 0, z: 0 });
    return true;
  }
}

export { DEBRIS, DEBRIS_KINDS };
