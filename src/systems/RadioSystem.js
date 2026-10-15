const BASE = 400;
const PER_ANTENNA = 300;

/**
 * @param {{x:number,z:number}} raftPos
 * @param {Array<{x:number,z:number,collected?:boolean,reached?:boolean}>} islands
 * @param {number} antennas
 */
export function radioReading(raftPos, islands, antennas) {
  const next = (islands || []).find((s) => !s.collected && !s.reached);
  if (!next) return null;
  const dx = next.x - raftPos.x;
  const dz = next.z - raftPos.z;
  const dist = Math.hypot(dx, dz);
  const range = BASE + (antennas || 0) * PER_ANTENNA;
  if (dist > range) return { signal: 0, dist: Math.round(dist), bearing: Math.atan2(dx, dz) };
  return {
    signal: 1 - dist / range,
    bearing: Math.atan2(dx, dz),
    dist: Math.round(dist)
  };
}

export function countAntennas(props) {
  let n = 0;
  for (const p of props || []) {
    if (p.id === 'antenna') n++;
  }
  return n;
}
