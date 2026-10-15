/** Survival rates — tuned for ~20–30 min loop before crisis if idle */
export const RATES = {
  thirst: 0.18,   // ~9 min full→0
  hunger: 0.10,   // ~17 min
  starve: 1.2,    // HP/s when critical
  regen: 0.5,     // HP/s when fed
  staminaSprint: 14,
  staminaWalk: 4,
  staminaRegen: 20
};

export function tickVitals(p, dt, R = RATES) {
  p.thirst = Math.max(0, p.thirst - R.thirst * dt);
  p.hunger = Math.max(0, p.hunger - R.hunger * dt);
  if (p.thirst < 5 || p.hunger < 5) {
    p.health = Math.max(0, p.health - R.starve * dt);
  } else if (p.health < 100 && p.oxygen > 40) {
    p.health = Math.min(100, p.health + R.regen * dt);
  }
  return p.health <= 0;
}
