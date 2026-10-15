/** Crop plot growth — pure data */
export const GROW_TIME = 45; // seconds to mature

export function createCropState() {
  return { planted: false, seed: null, progress: 0, ready: false };
}

export function tickCrop(c, dt) {
  if (!c.planted || c.ready) return;
  c.progress += dt;
  if (c.progress >= GROW_TIME) {
    c.progress = GROW_TIME;
    c.ready = true;
  }
}
