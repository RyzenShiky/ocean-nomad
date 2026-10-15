import { t } from '../i18n/index.js';
export const HOTBAR_SIZE = 10;
export const INV_SIZE = 30;

export const ITEM_DEFS = {
  axe_iron:    { icon: '⛏️', maxStack: 1,  usable: false },
  stew:        { icon: '🍲', maxStack: 8,  usable: true,  use: { eat: 45, drink: 35 } },
  fish_soup:   { icon: '🥣', maxStack: 8,  usable: true,  use: { eat: 25, drink: 25 } },
  shark_stew:  { icon: '🥘', maxStack: 8,  usable: true,  use: { eat: 60, drink: 20 } },
  hearty_plate:{ icon: '🍽️', maxStack: 8,  usable: true,  use: { eat: 55 } },
  biofuel:     { icon: '🛢️', maxStack: 16, usable: false },
  bandage:     { icon: '🩹', maxStack: 8,  usable: true,  use: { heal: 25 } },
  wood:        { icon: '🪵', maxStack: 64, usable: false },
  plank:       { icon: '📏', maxStack: 64, usable: false },
  rope:        { icon: '🪢', maxStack: 32, usable: false },
  plastic:     { icon: '🧴', maxStack: 32, usable: false },
  scrap:       { icon: '⚙️', maxStack: 32, usable: false },
  food:        { icon: '🥫', maxStack: 16, usable: true,  use: { eat: 40 } },
  water:       { icon: '💧', maxStack: 16, usable: true,  use: { drink: 35 } },
  raw_fish:    { icon: '🐟', maxStack: 16, usable: false },
  cooked_fish: { icon: '🍳', maxStack: 16, usable: true,  use: { eat: 40 } },
  salt_water:  { icon: '🌊', maxStack: 16, usable: false },
  raw_shark:   { icon: '🥩', maxStack: 8,  usable: false },
  cooked_shark:{ icon: '🍖', maxStack: 8,  usable: true,  use: { eat: 50 } },
  palm_leaf:   { icon: '🌿', maxStack: 32, usable: false },
  seed:        { icon: '🌱', maxStack: 16, usable: false },
  potato:      { icon: '🥔', maxStack: 16, usable: true,  use: { eat: 25 } },
  research:    { icon: '📘', maxStack: 20, usable: false },
  hammer:      { icon: '🔨', maxStack: 1,  usable: false },
  hook:        { icon: '🪝', maxStack: 1,  usable: false },
  axe:         { icon: '🪓', maxStack: 1,  usable: false },
  metal_ingot: { icon: '🪙', maxStack: 32, usable: false },
  metal_key:   { icon: '🔑', maxStack: 5,  usable: false },
  note:        { icon: '📜', maxStack: 10, usable: false },
  spear:       { icon: '🔱', maxStack: 1,  usable: false },
  rod:         { icon: '🎣', maxStack: 1,  usable: false }
};

for (const [id, def] of Object.entries(ITEM_DEFS)) {
  Object.defineProperty(def, 'name', {
    get() { return t([`item.${id}`, id.replace(/_/g, ' ')]); },
    configurable: true,
    enumerable: true
  });
}


export class Inventory {
  constructor() {
    this.slots = Array(INV_SIZE).fill(null);
    this.selected = 0;
    this.add('hammer');
    this.add('hook');
    this.add('axe');
    this.add('wood', 18);
    this.add('plank', 12);
    this.add('rope', 2);
    this.add('plastic', 4);
    this.add('scrap', 2);
    this.add('food', 3);
    this.add('water', 3);
  }

  get selectedSlot() { return this.slots[this.selected]; }

  select(i) {
    if (i >= 0 && i < HOTBAR_SIZE) this.selected = i;
  }

  swap(a, b) {
    if (a < 0 || b < 0 || a >= INV_SIZE || b >= INV_SIZE) return;
    [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]];
  }

  static fit(saved) {
    return Array.from({ length: INV_SIZE }, (_, i) => saved?.[i] ?? null);
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  canAdd(id, n = 1) {
    const def = ITEM_DEFS[id];
    if (!def) return false;
    let room = 0;
    for (const s of this.slots) {
      room += !s ? def.maxStack : (s.id === id ? def.maxStack - s.count : 0);
    }
    return room >= n;
  }

  add(id, amount = 1) {
    const def = ITEM_DEFS[id];
    if (!def || amount <= 0) return amount;
    for (const s of this.slots) {
      if (!s || s.id !== id) continue;
      const space = def.maxStack - s.count;
      if (space <= 0) continue;
      const put = Math.min(space, amount);
      s.count += put;
      amount -= put;
      if (amount <= 0) return 0;
    }
    for (let i = 0; i < INV_SIZE && amount > 0; i++) {
      if (this.slots[i]) continue;
      const put = Math.min(def.maxStack, amount);
      this.slots[i] = { id, count: put };
      amount -= put;
    }
    return amount;
  }

  remove(id, amount = 1) {
    let left = amount;
    for (let i = 0; i < INV_SIZE && left > 0; i++) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(s.count, left);
      s.count -= take;
      left -= take;
      if (s.count <= 0) this.slots[i] = null;
    }
    return amount - left;
  }

  has(id, amount = 1) { return this.count(id) >= amount; }

  useSelected(player) {
    const s = this.selectedSlot;
    if (!s) return false;
    const def = ITEM_DEFS[s.id];
    if (!def?.usable) return false;
    const u = def.use;
    if (!u) return false;
    if (u.eat) player.eat?.(u.eat);
    if (u.drink) player.drink?.(u.drink);
    if (u.heal) player.heal?.(u.heal);
    s.count--;
    if (s.count <= 0) this.slots[this.selected] = null;
    return true;
  }
}
