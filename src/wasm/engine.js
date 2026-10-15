import {
  waveHeight,
  stormFactor,
  freezeFactor,
  seaLevelOffset
} from '../world/Ocean.js';

let ex = null;
let memView = null;
let ioPtr = 0;

/** Load STANDALONE_WASM ocean batch. Never throws — falls back to JS. */
export async function initWasm(baseUrl = './') {
  try {
    const url = new URL('wasm/engine.wasm', new URL(baseUrl, location.href)).href;
    let result;
    if (typeof WebAssembly.instantiateStreaming === 'function') {
      try {
        result = await WebAssembly.instantiateStreaming(fetch(url), {});
      } catch {
        const buf = await (await fetch(url)).arrayBuffer();
        result = await WebAssembly.instantiate(buf, {});
      }
    } else {
      const buf = await (await fetch(url)).arrayBuffer();
      result = await WebAssembly.instantiate(buf, {});
    }
    ex = result.instance.exports;
    if (typeof ex._initialize === 'function') ex._initialize();
    if (typeof ex.io !== 'function' || typeof ex.ocean_batch !== 'function') {
      throw new Error('missing exports');
    }
    ioPtr = ex.io();
    memView = null;
    console.info('[wasm] ocean engine ready');
    return true;
  } catch (e) {
    console.warn('[wasm] ocean engine unavailable, using JS waveHeight', e);
    ex = null;
    return false;
  }
}

function syncParams() {
  if (ex && typeof ex.ocean_set_params === 'function') {
    ex.ocean_set_params(stormFactor, freezeFactor, seaLevelOffset);
  }
}

/**
 * @param {Float32Array|number[]} xz interleaved x,z
 * @param {number} n number of points
 * @param {number} t time
 * @param {Float32Array|number[]} out heights length n
 */
export function waveBatch(xz, n, t, out) {
  if (n <= 0) return;
  if (!ex) {
    for (let i = 0; i < n; i++) out[i] = waveHeight(xz[i * 2], xz[i * 2 + 1], t);
    return;
  }
  syncParams();
  const need = n * 3;
  if (!memView || memView.buffer !== ex.memory.buffer || memView.length < need) {
    memView = new Float32Array(ex.memory.buffer, ioPtr, Math.min(4096 * 3, need));
  }
  const m = memView;
  const count = Math.min(n, 4096);
  for (let i = 0; i < count; i++) {
    m[i * 3] = xz[i * 2];
    m[i * 3 + 1] = xz[i * 2 + 1];
  }
  ex.ocean_batch(count, t);
  for (let i = 0; i < count; i++) out[i] = m[i * 3 + 2];
  for (let i = count; i < n; i++) out[i] = waveHeight(xz[i * 2], xz[i * 2 + 1], t);
}

export function wasmActive() {
  return !!ex;
}
