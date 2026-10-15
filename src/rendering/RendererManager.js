import * as THREE from 'three';

/**
 * Creates a renderer. WebGPU is detected but not required —
 * full WebGPURenderer needs extra three addons; we log capability
 * and use WebGL2/WebGL until those are vendored.
 */
export async function createRenderer(canvas, caps) {
  if (!caps.webgl2 && !caps.webgl1) {
    throw new Error('WebGL is not available in this browser. Ocean Nomad needs WebGL2 (or WebGL).');
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: caps.gpuTier !== 'low',
    powerPreference: 'high-performance',
    alpha: false
  });
  renderer.setPixelRatio(1);
  renderer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  return {
    backend: caps.webgl2 ? 'webgl2' : 'webgl',
    webgpuAvailable: !!caps.webgpu,
    renderer,
    applyQuality(q, scene) {
      const pr = Math.min(
        typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
        q.pixelRatioMax ?? 1.5
      ) * (q.resolutionScale ?? 1);
      renderer.setPixelRatio(pr);
      renderer.setSize(innerWidth, innerHeight, false);

      renderer.shadowMap.enabled = q.shadows !== 'off';
      const type = q.shadows === 'high' ? THREE.PCFSoftShadowMap
        : q.shadows === 'medium' ? THREE.PCFShadowMap
        : THREE.BasicShadowMap;
      if (renderer.shadowMap.type !== type) {
        renderer.shadowMap.type = type;
        scene?.traverse?.(o => {
          if (!o.material) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) if (m) m.needsUpdate = true;
        });
      }
      renderer.shadowMap.needsUpdate = true;
      return pr;
    }
  };
}
