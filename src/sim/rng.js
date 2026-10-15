/** Mulberry32 — deterministic, seedable */
export function createRng(seed = 123456789) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.seed = () => s;
  next.setSeed = (v) => { s = v >>> 0; };
  next.range = (a, b) => a + next() * (b - a);
  next.int = (a, b) => (a + Math.floor(next() * (b - a + 1))) | 0;
  return next;
}
