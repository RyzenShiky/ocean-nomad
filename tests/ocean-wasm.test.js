/**
 * Node test: Wasm ocean_batch vs JS waveHeight parity.
 * Run: node tests/ocean-wasm.test.js
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

const WAVES = [
  [1.0, 0.0, 0.12, 0.32, 1.1],
  [0.0, 1.0, 0.09, 0.26, 0.85],
  [0.71, 0.71, 0.07, 0.16, 0.6],
  [0.9, -0.44, 0.05, 0.11, 0.4],
  [0.3, 0.95, 0.28, 0.05, 1.8],
  [-0.7, 0.7, 0.45, 0.03, 2.4],
];

function waveHeightJS(x, z, t, storm = 0, freeze = 0, sea = 0) {
  const _sf = 1 + 1.6 * storm;
  let h = 0;
  for (const [dx, dz, k, a, s] of WAVES) {
    h += a * _sf * Math.sin(k * (dx * x + dz * z) + s * t);
  }
  h *= 1 - 0.9 * freeze;
  return sea + h;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const buf = readFileSync(join(root, 'wasm/engine.wasm'));
const { instance } = await WebAssembly.instantiate(buf, {});
const ex = instance.exports;
if (typeof ex._initialize === 'function') ex._initialize();

assert(typeof ex.io === 'function', 'io export');
assert(typeof ex.ocean_batch === 'function', 'ocean_batch export');
assert(typeof ex.ocean_set_params === 'function', 'ocean_set_params export');

const ptr = ex.io();
const mem = new Float32Array(ex.memory.buffer, ptr, 3);
let maxDiff = 0;

const samples = [
  [0, 0, 0, 0, 0, 0],
  [10, 10, 1.5, 0.2, 0.1, 0.5],
  [3.2, -7.1, 12, 1, 0.5, -0.3],
  [-50, 80, 3.14, 0, 1, 0],
  [1.1, 2.2, 0.5, 0.8, 0.25, 1.25],
];

for (const [x, z, t, storm, freeze, sea] of samples) {
  mem[0] = x;
  mem[1] = z;
  ex.ocean_set_params(storm, freeze, sea);
  ex.ocean_batch(1, t);
  const js = waveHeightJS(x, z, t, storm, freeze, sea);
  const d = Math.abs(mem[2] - js);
  maxDiff = Math.max(maxDiff, d);
  assert(d < 1e-5, `diff ${d} at (${x},${z},t=${t}) wasm=${mem[2]} js=${js}`);
}

const n = 8;
const big = new Float32Array(ex.memory.buffer, ptr, n * 3);
ex.ocean_set_params(0.3, 0.2, 0.1);
for (let i = 0; i < n; i++) {
  big[i * 3] = i * 2.5;
  big[i * 3 + 1] = i * -1.3;
}
ex.ocean_batch(n, 4.2);
for (let i = 0; i < n; i++) {
  const js = waveHeightJS(i * 2.5, i * -1.3, 4.2, 0.3, 0.2, 0.1);
  const d = Math.abs(big[i * 3 + 2] - js);
  maxDiff = Math.max(maxDiff, d);
  assert(d < 1e-5, `batch[${i}] diff ${d}`);
}

console.log(`ocean-wasm.test.js PASS (maxDiff=${maxDiff})`);
