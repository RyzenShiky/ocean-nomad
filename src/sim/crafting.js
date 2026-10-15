import { emit } from './bus.js';

const snapshot = (inv) =>
  inv.snapshot?.() ?? structuredClone(inv.slots);
const restore = (inv, s) => {
  if (inv.restore) inv.restore(s);
  else inv.slots = s;
};

export const canCraft = (inv, r) =>
  Object.entries(r.requires).every(([id, n]) => inv.has(id, n));

/** Atomic craft: if output doesn't fit, inventory (+chests) restored */
export function craft(inv, r) {
  if (!canCraft(inv, r)) return false;
  const snap = snapshot(inv);
  for (const [id, n] of Object.entries(r.requires)) inv.remove(id, n);
  let left = 0;
  for (const [id, n] of Object.entries(r.output ?? {})) {
    left += inv.add(id, n);
  }
  if (left > 0) {
    restore(inv, snap);
    emit('inventory_full', { id: r.id });
    return false;
  }
  emit('crafted', { id: r.id });
  return true;
}

/** Dry-run: 'ok' | 'missing' | 'full' */
export function craftCheck(inv, r) {
  if (!canCraft(inv, r)) return 'missing';
  const snap = snapshot(inv);
  for (const [id, n] of Object.entries(r.requires)) inv.remove(id, n);
  let left = 0;
  for (const [id, n] of Object.entries(r.output ?? {})) left += inv.add(id, n);
  restore(inv, snap);
  return left > 0 ? 'full' : 'ok';
}
