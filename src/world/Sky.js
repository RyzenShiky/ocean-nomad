const hex = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
const KEYS = [
  [-0.20, 0x0a1526, 0x02060f, 0x000000, 0.00, 0.09],
  [-0.08, 0x2a2446, 0x070f2a, 0x000000, 0.00, 0.12],
  [-0.01, 0xb0603c, 0x1d3060, 0xff7a3a, 0.20, 0.22],
  [ 0.05, 0xe98a4e, 0x2a4a80, 0xff8f4a, 0.60, 0.32],
  [ 0.20, 0xf2c08a, 0x3a6aa8, 0xffd9a8, 1.10, 0.42],
  [ 0.50, 0x9cc4dc, 0x3d78b8, 0xfff4e0, 1.50, 0.50],
  [ 1.00, 0x87b8d8, 0x3d78b8, 0xfff4e0, 1.55, 0.50]
].map(k => ({ e: k[0], H: hex(k[1]), Z: hex(k[2]), S: hex(k[3]), sunI: k[4], amb: k[5] }));

const lerp = (a, b, u) => a.map((x, i) => x + (b[i] - x) * u);

export function skyState(e) {
  e = Math.min(1, Math.max(KEYS[0].e, e));
  let i = 1;
  while (i < KEYS.length - 1 && e > KEYS[i].e) i++;
  const a = KEYS[i - 1], b = KEYS[i];
  const u = (e - a.e) / (b.e - a.e || 1);
  return {
    H: lerp(a.H, b.H, u),
    Z: lerp(a.Z, b.Z, u),
    S: lerp(a.S, b.S, u),
    sunI: a.sunI + (b.sunI - a.sunI) * u,
    amb: a.amb + (b.amb - a.amb) * u
  };
}
