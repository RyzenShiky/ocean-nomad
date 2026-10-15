/** Engine / helm thrust — host-only in multiplayer. */
export const ENGINES = {
  engine_bio: { thrust: 0.9, fuel: 'biofuel', burnPerSec: 1 / 40 },
  engine_elec: { thrust: 1.4, power: 2 }
};

/**
 * @param {Iterable} props values of raft.props
 * @param {number} dt
 * @param {number} helm yaw radians (0 = +Z)
 * @param {{x:number,z:number}} vel
 * @param {number} power available electric power
 */
export function tickEngines(props, dt, helm, vel, power = 0) {
  let thrust = 0;
  for (const p of props) {
    const d = ENGINES[p.id];
    if (!d || !p.on) continue;
    if (d.fuel) {
      p.fuel = Math.max(0, (p.fuel ?? 0) - d.burnPerSec * dt);
      if (!p.fuel) {
        p.on = false;
        continue;
      }
    } else if (power < (d.power || 0)) {
      continue;
    }
    thrust += d.thrust;
  }
  if (thrust > 0) {
    vel.x += Math.sin(helm) * thrust * dt;
    vel.z += Math.cos(helm) * thrust * dt;
  }
  return thrust;
}

export const toggleAll = (props, on) => {
  for (const p of props) {
    if (ENGINES[p.id]) p.on = on;
  }
};

export function countPower(props) {
  let pwr = 0;
  for (const p of props) {
    if (p.id === 'solar_panel') pwr += 1.5;
    if (p.id === 'battery' && (p.charge ?? 0) > 0) pwr += 1;
  }
  return pwr;
}
