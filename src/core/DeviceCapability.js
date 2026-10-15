/**
 * Boot-time capability probe. Never throws — always returns a usable profile.
 * WebGPU / Worker / WASM are optional; WebGL2 is the reliable baseline.
 */
export async function detectCapabilities() {
  const canvas = document.createElement('canvas');
  let webgl2 = false;
  let webgl1 = false;
  let maxTex = 2048;
  let renderer = 'unknown';
  try {
    const gl = canvas.getContext('webgl2', { powerPreference: 'high-performance' });
    if (gl) {
      webgl2 = true;
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || renderer;
    } else {
      const gl1 = canvas.getContext('webgl');
      webgl1 = !!gl1;
    }
  } catch (_) { /* ignore */ }

  let webgpu = false;
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      webgpu = !!adapter;
    } catch (_) {
      webgpu = false;
    }
  }

  const worker = typeof Worker !== 'undefined';
  let wasm = false;
  try {
    wasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
  } catch (_) { wasm = false; }

  const cores = navigator.hardwareConcurrency || 2;
  const mem = navigator.deviceMemory || 0; // GB, Chrome only
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  const isTouch = (typeof window !== 'undefined') &&
    (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));

  // Heuristic GPU tier
  const lowHints = /Mali|Adreno 3|Adreno 4|PowerVR|Intel HD|SwiftShader|llvmpipe/i.test(renderer);
  const highHints = /RTX|RX 6|RX 7|Apple M[1-9]|Arc A|GeForce (20|30|40)|Radeon RX/i.test(renderer);
  let gpuTier = 'medium';
  if (!webgl2 || lowHints || mobile || (mem && mem <= 4)) gpuTier = 'low';
  if (highHints && webgl2 && !mobile && maxTex >= 8192) gpuTier = 'high';

  const recommendedQuality =
    gpuTier === 'low' ? 'low' : gpuTier === 'high' ? 'high' : 'medium';

  return {
    webgl2,
    webgl1,
    webgpu,
    worker,
    wasm,
    cores,
    deviceMemoryGB: mem,
    maxTextureSize: maxTex,
    gpuRenderer: renderer,
    gpuTier,
    mobile,
    isTouch,
    dpr,
    recommendedQuality,
    secureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
    crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false
  };
}
