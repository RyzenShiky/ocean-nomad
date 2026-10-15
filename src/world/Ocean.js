import * as THREE from 'three';

/** Single source of truth: CPU physics waves (large scale only) */
export const WAVES = [
  [1.0,  0.0,  0.12, 0.32, 1.10],
  [0.0,  1.0,  0.09, 0.26, 0.85],
  [0.71, 0.71, 0.07, 0.16, 0.60],
  [0.90,-0.44, 0.05, 0.11, 0.40],
  [0.30, 0.95, 0.28, 0.05, 1.80],
  [-0.7, 0.70, 0.45, 0.03, 2.40]
];

export let stormFactor = 0;
export function setStormFactor(s) { stormFactor = s; }

/** Absolute water-level shift (m): + rise / surge, − drawback. Independent of storm amplitude. */
export let seaLevelOffset = 0;
export function setSeaLevelOffset(v) { seaLevelOffset = v; }

/** 0..1 ice cover — flattens waves for CPU buoyancy too */
export let freezeFactor = 0;
export function setFreezeFactor(v) { freezeFactor = Math.max(0, Math.min(1, v)); }

export function waveHeight(x, z, t) {
  const _sf = 1 + 1.6 * stormFactor;
  let h = 0;
  for (let i = 0; i < WAVES.length; i++) {
    const [dx, dz, k, a, s] = WAVES[i];
    h += a * _sf * Math.sin(k * (dx * x + dz * z) + s * t);
  }
  h *= (1 - 0.9 * freezeFactor);
  return seaLevelOffset + h;
}

export function waveNormal(x, z, t, eps = 0.45) {
  const h  = waveHeight(x, z, t);
  const hx = waveHeight(x + eps, z, t);
  const hz = waveHeight(x, z + eps, t);
  return new THREE.Vector3(h - hx, eps, h - hz).normalize();
}

export const OCEAN_SIZE = 500;
export const OCEAN_SEGS = 128;
const OCEAN_LOD = { low: 64, medium: 96, high: 128 };

export function createOcean(scene) {
  const geo = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, OCEAN_SEGS, OCEAN_SEGS);
  geo.rotateX(-Math.PI / 2);

  const uWaveA = [];
  const uWaveS = [];
  for (const [dx, dz, k, a, s] of WAVES) {
    uWaveA.push(new THREE.Vector4(dx, dz, k, a));
    uWaveS.push(s);
  }

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWaveA: { value: uWaveA },
      uWaveS: { value: uWaveS },
      uColorDeep: { value: new THREE.Color(0x0a2a4a) },
      uColorShallow: { value: new THREE.Color(0x1a6e9a) },
      uSunDir: { value: new THREE.Vector3(40, 80, 25).normalize() },
      uSkyHorizon: { value: new THREE.Color(0x87b8d8) },
      uSkyZenith: { value: new THREE.Color(0x3d78b8) },
      uFogColor: { value: new THREE.Color(0x87b8d8) },
      uFogDensity: { value: 0.012 },
      uCameraPos: { value: new THREE.Vector3() },
      uLight: { value: 1 },
      uStorm: { value: 0 },
      uSeaOffset: { value: 0 },
      uFreeze: { value: 0 },
      uSunVis: { value: 1 },
      uSunCol: { value: new THREE.Color(0xfff4e0) }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uStorm;
      uniform float uSeaOffset;
      uniform float uFreeze;
      uniform vec4 uWaveA[6];
      uniform float uWaveS[6];
      varying float vWave;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      void waveHG(vec2 p, float t, out float h, out vec2 g) {
        h = 0.0; g = vec2(0.0);
        for (int i = 0; i < 6; i++) {
          vec4 w = uWaveA[i];
          float ph = w.z * dot(w.xy, p) + uWaveS[i] * t;
          h += w.w * (1.0 + 1.6 * uStorm) * sin(ph);
          g += w.xy * (w.w * (1.0 + 1.6 * uStorm) * w.z * cos(ph));
        }
      }

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        float h; vec2 g;
        waveHG(world.xz, uTime, h, g);
        h *= (1.0 - uFreeze * 0.9);
        g *= (1.0 - uFreeze * 0.9);
        vNormal = normalize(vec3(-g.x, 1.0, -g.y));
        world.y += h + uSeaOffset;
        vWave = h;
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFogDensity;
      uniform vec3 uColorDeep;
      uniform vec3 uColorShallow;
      uniform vec3 uSkyHorizon;
      uniform vec3 uSkyZenith;
      uniform vec3 uSunDir;
      uniform vec3 uFogColor;
      uniform float uLight;
      uniform float uFreeze;
      uniform float uSunVis;
      uniform vec3 uSunCol;
      uniform vec3 uCameraPos;
      varying float vWave;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      vec2 rip(vec2 d, float a, float k, float s, vec2 p) {
        return d * (a * k * cos(dot(d, p) * k + s * uTime));
      }

      void main() {
        vec3 P = vWorldPos;
        vec3 V = normalize(uCameraPos - P);
        float dist = distance(P, uCameraPos);
        float f1 = 1.0 - smoothstep(18.0, 80.0, dist);
        float f2 = 1.0 - smoothstep(6.0, 32.0, dist);
        vec2 p = P.xz;
        vec2 g = vec2(0.0);
        g += f1 * rip(vec2( 0.80, 0.60), 0.040, 1.10, 1.7, p);
        g += f1 * rip(vec2(-0.60, 0.80), 0.030, 1.70, 2.1, p);
        g += f1 * rip(vec2( 0.30,-0.95), 0.020, 2.90, 2.9, p);
        g += f1 * rip(vec2(-0.95,-0.30), 0.013, 4.80, 3.6, p);
        g += f2 * rip(vec2( 0.55, 0.83), 0.0050,  9.0, 4.5, p);
        g += f2 * rip(vec2(-0.83, 0.55), 0.0032, 14.0, 5.6, p);
        g += f2 * rip(vec2( 0.10,-0.99), 0.0022, 21.0, 6.8, p);

        // Slope from large wave normal + detail ripples
        vec2 s = -vNormal.xz / max(vNormal.y, 0.001) + g;
        vec3 N = normalize(vec3(-s.x, 1.0, -s.y));

        float NV = clamp(dot(N, V), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - NV, 5.0);
        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        vec3 sky = mix(uSkyHorizon, uSkyZenith, sqrt(clamp(R.y, 0.0, 1.0)));

        vec3 body = mix(uColorDeep, uColorShallow,
          clamp(0.30 + 0.35 * vWave + 0.30 * (1.0 - NV), 0.0, 1.0));
        body += vec3(0.01, 0.10, 0.09) * smoothstep(0.10, 0.75, vWave);
        body *= max(uLight, 0.10) * mix(vec3(1.0), uSunCol * 1.6 + 0.2, 0.35 * uSunVis);
        vec3 col = mix(body, sky, F);

        vec3 H = normalize(uSunDir + V);
        col += uSunCol * pow(max(dot(N, H), 0.0), 900.0) * 9.0 * uSunVis;

        float foam = smoothstep(0.50, 0.85, vWave + 0.4 * (length(g) - 0.06)) * f1;
        col = mix(col, vec3(0.85, 0.92, 0.95) * max(uLight, 0.10), foam * 0.55);
        col = mix(col, vec3(0.85, 0.90, 0.94) * max(uLight, 0.15), uFreeze);
        if (!gl_FrontFacing) col = mix(uColorShallow * 0.5, vec3(0.7, 0.8, 0.88), uFreeze);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, fog);
      }
    `,
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  scene.add(mesh);

  let segs = OCEAN_SEGS;
  let cell = OCEAN_SIZE / segs;

  return {
    mesh,
    material: mat,
    get cell() { return cell; },
    setDetail(level) {
      const n = OCEAN_LOD[level] ?? OCEAN_SEGS;
      if (n === segs) return;
      segs = n;
      cell = OCEAN_SIZE / n;
      const g = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, n, n);
      g.rotateX(-Math.PI / 2);
      mesh.geometry.dispose();
      mesh.geometry = g;
    },
    update(time, camera) {
      mat.uniforms.uTime.value = time;
      if (camera) {
        mat.uniforms.uCameraPos.value.copy(camera.position);
        const g = cell;
        mesh.position.x = Math.round(camera.position.x / g) * g;
        mesh.position.z = Math.round(camera.position.z / g) * g;
      }
    },
    setSeaOffset(v) {
      mat.uniforms.uSeaOffset.value = v;
    },
    setFreeze(v) {
      mat.uniforms.uFreeze.value = v;
    },
    setFog(color, density) {
      // Fog mixed after tone-map → keep sRGB-ish values
      mat.uniforms.uFogColor.value.copy(color);
      if (mat.uniforms.uFogColor.value.convertLinearToSRGB) {
        mat.uniforms.uFogColor.value.convertLinearToSRGB();
      }
      mat.uniforms.uFogDensity.value = density;
    }
  };
}
