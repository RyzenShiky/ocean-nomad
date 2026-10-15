import { detectCapabilities } from './DeviceCapability.js';
import { QualityManager } from '../rendering/QualityManager.js';
import { createRenderer } from '../rendering/RendererManager.js';
import { initWasm } from '../wasm/engine.js';

function setLoading(status, pct) {
  const el = document.querySelector('#loading .status');
  if (el) el.textContent = status;
  const bar = document.getElementById('progress');
  if (bar && pct != null) bar.style.width = Math.round(pct * 100) + '%';
}

/**
 * Async boot: capability → renderer → quality → Game.
 * Never requires WebGPU / Worker / WASM to start.
 */
export async function boot(canvas) {
  setLoading('Mendeteksi perangkat…', 0.1);
  const caps = await detectCapabilities();
  console.info('[Ocean Nomad] capabilities', caps);

  setLoading('Memuat modul laut…', 0.2);
  await initWasm('./');

  if (!caps.webgl2 && !caps.webgl1) {
    setLoading('WebGL not supported — cannot run Ocean Nomad.', 0);
    throw new Error('No WebGL');
  }

  setLoading(
    caps.webgpu ? 'WebGL siap…' : 'Menjalankan WebGL…',
    0.35
  );

  const renderCtx = await createRenderer(canvas, caps);

  const savedQ = localStorage.getItem('driftbound:quality');
  const initialQ = savedQ && ['low', 'medium', 'high'].includes(savedQ)
    ? savedQ
    : caps.recommendedQuality;
  const quality = new QualityManager(initialQ);
  renderCtx.applyQuality(quality.settings);

  setLoading('Menyiapkan laut & sistem…', 0.55);

  // Dynamic import keeps boot screen visible until modules parse
  const { Game } = await import('./Game.js');
  setLoading('Membangun rakit…', 0.85);

  const game = new Game(canvas, { caps, quality, renderCtx });
  setLoading('Siap', 1);

  // Hide loading after a short paint
  requestAnimationFrame(() => {
    document.getElementById('loading')?.classList.add('hidden');
  });

  return { game, caps, quality, renderCtx };
}
