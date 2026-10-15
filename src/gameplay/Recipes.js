import { t } from '../i18n/index.js';
export const RECIPES = {
  plank: {
    id: 'plank', name: 'Plank', icon: '📏', category: 'resources',
    desc: 'Basic building material from wood.',
    type: 'craft', requires: { wood: 1 }, output: { plank: 2 }, locked: false
  },
  rope: {
    id: 'rope', name: 'Rope', icon: '🪢', category: 'resources',
    desc: 'Strong rope for binding.',
    type: 'craft', requires: { plastic: 2 }, output: { rope: 1 }, locked: false
  },
  axe: {
    id: 'axe', name: 'Axe', icon: '🪓', category: 'tools',
    desc: 'Dismantle buildings.',
    type: 'craft', requires: { plank: 2, scrap: 2 }, output: { axe: 1 }, locked: false
  },
  rod: {
    id: 'rod', name: 'Fishing Rod', icon: '🎣', category: 'tools',
    desc: 'Catch fish from the ocean.',
    type: 'craft', requires: { plank: 2, rope: 2, scrap: 1 }, output: { rod: 1 }, locked: false
  },
  metal_key: {
    id: 'metal_key', name: 'Metal Key', icon: '🔑', category: 'tools',
    desc: 'Crafted from 3 metal ingots.',
    type: 'craft', requires: { metal_ingot: 3 }, output: { metal_key: 1 }, locked: false
  },
  spear: {
    id: 'spear', name: 'Spear', icon: '🔱', category: 'tools',
    desc: 'Defend against sharks.',
    type: 'craft', requires: { plank: 2, scrap: 1, rope: 1 }, output: { spear: 1 }, locked: false
  },
  axe_iron: {
    id: 'axe_iron', name: 'Kapak Besi', icon: '⛏️', category: 'tools',
    desc: 'Lebih cepat membongkar & menebang. Butuh ingot.',
    type: 'craft', requires: { metal_ingot: 3, plank: 2 }, output: { axe_iron: 1 }, locked: false
  },
  stew: {
    id: 'stew', name: 'Sup Ikan', icon: '🍲', category: 'food',
    desc: 'Mengisi lapar + haus sekaligus.',
    type: 'craft', requires: { cooked_fish: 1, potato: 1, water: 1 }, output: { stew: 1 }, locked: false
  },
  fish_soup: {
    id: 'fish_soup', name: 'Kuah Laut', icon: '🥣', category: 'food',
    desc: 'Masakan sederhana dari ikan matang dan air.',
    type: 'craft', requires: { cooked_fish: 1, water: 1 }, output: { fish_soup: 1 }, locked: false
  },
  lamp: {
    id: 'lamp', name: 'Lampu', icon: '🏮', category: 'structure',
    desc: 'Penerangan malam di rakit.',
    type: 'build', requires: { scrap: 2, plastic: 1, plank: 1 }, output: null, locked: false
  },
  drying_rack: {
    id: 'drying_rack', name: 'Jemuran', icon: '🧺', category: 'food',
    desc: 'Pengawet makanan (prop).',
    type: 'build', requires: { plank: 4, rope: 2 }, output: null, locked: false
  },
  spear_trap: {
    id: 'spear_trap', name: 'Jebakan Tombak', icon: '🗡️', category: 'structure',
    desc: 'Pertahanan rakit — melukai hiu yang mendekat.',
    type: 'build', requires: { plank: 3, scrap: 2, rope: 1 }, output: null, locked: false
  },
  // Build-only (radial)
  raft_cell: {
    id: 'raft_cell', name: 'Raft Floor', icon: '🟫', category: 'structure',
    desc: 'Expand your raft by one cell.',
    type: 'build', requires: { plank: 2 }, output: null, locked: false
  },
  wall: {
    id: 'wall', name: 'Wall', icon: '🧱', category: 'structure',
    desc: 'Edge wall. Snaps to floor sides.',
    type: 'build', requires: { plank: 4 }, output: null, locked: false
  },
  window: {
    id: 'window', name: 'Window', icon: '🪟', category: 'structure',
    desc: 'Wall with a window opening.',
    type: 'build', requires: { plank: 3, plastic: 1 }, output: null, locked: false
  },
  door: {
    id: 'door', name: 'Door', icon: '🚪', category: 'structure',
    desc: 'Passable doorway on an edge.',
    type: 'build', requires: { plank: 4, scrap: 1 }, output: null, locked: false
  },
  pillar: {
    id: 'pillar', name: 'Pillar', icon: '🪵', category: 'structure',
    desc: 'Corner support pillar.',
    type: 'build', requires: { plank: 2 }, output: null, locked: false
  },
  roof: {
    id: 'roof', name: 'Roof', icon: '🏠', category: 'structure',
    desc: 'Roof panel above a floor cell.',
    type: 'build', requires: { plank: 4, palm_leaf: 2 }, output: null, locked: false
  },
  simple_grill: {
    id: 'simple_grill', name: 'Simple Grill', icon: '🔥', category: 'food',
    desc: 'Cook food. E to use.',
    type: 'build', requires: { plank: 6, scrap: 1, rope: 1 }, output: null, locked: false
  },
  purifier: {
    id: 'purifier', name: 'Purifier', icon: '⚗️', category: 'food',
    desc: 'Salt water → water.',
    type: 'build', requires: { plank: 6, scrap: 2, plastic: 2 }, output: null, locked: false
  },
  crop_plot: {
    id: 'crop_plot', name: 'Crop Plot', icon: '🪴', category: 'food',
    desc: 'Plant seeds, harvest.',
    type: 'build', requires: { plank: 4, plastic: 2 }, output: null, locked: true
  },
  small_storage: {
    id: 'small_storage', name: 'Small Chest', icon: '📦', category: 'structure',
    desc: 'Store items. E to open.',
    type: 'build', requires: { plank: 6, scrap: 2 }, output: null, locked: false
  },
  large_storage: {
    id: 'large_storage', name: 'Large Chest', icon: '🗄️', category: 'structure',
    desc: 'Bigger storage.',
    type: 'build', requires: { plank: 12, scrap: 4, rope: 2 }, output: null, locked: true
  },
  research_table: {
    id: 'research_table', name: 'Research Table', icon: '📘', category: 'survival',
    desc: 'Unlock recipes.',
    type: 'build', requires: { plank: 10, scrap: 4, plastic: 2 }, output: null, locked: false
  },
  simple_bed: {
    id: 'simple_bed', name: 'Simple Bed', icon: '🛏️', category: 'survival',
    desc: 'Sleep to heal.',
    type: 'build', requires: { plank: 6, rope: 2, plastic: 2 }, output: null, locked: false
  },
  smelter: {
    id: 'smelter', name: 'Smelter', icon: '⚒️', category: 'structure',
    desc: '3 scrap + fuel → metal ingot.',
    type: 'build', requires: { plank: 8, scrap: 4, rope: 2 }, output: null, locked: true
  },
  stairs: {
    id: 'stairs', name: 'Stairs', icon: '🪜', category: 'structure',
    desc: 'Climb to floor 2 (need roof).',
    type: 'build', requires: { plank: 6 }, output: null, locked: false
  },
  net: {
    id: 'net', name: 'Collection Net', icon: '🕸️', category: 'structure',
    desc: 'Auto-collects nearby debris.',
    type: 'build', requires: { plank: 2, rope: 4, plastic: 2 }, output: null, locked: false
  },
  sail: {
    id: 'sail', name: 'Sail', icon: '⛵', category: 'structure',
    desc: 'Steer with wind. E toggle.',
    type: 'build', requires: { plank: 4, rope: 4, palm_leaf: 6 }, output: null, locked: true
  }
  ,
  rope_leaf: {
    id: 'rope_leaf', name: 'Tali daun', icon: '🪢', category: 'resources', type: 'craft',
    requires: { palm_leaf: 4 }, output: { rope: 1 },
    desc: 'Tali dari daun palem.'
  },
  shark_stew: {
    id: 'shark_stew', name: 'Sup hiu', icon: '🥘', category: 'food', type: 'craft',
    requires: { cooked_shark: 1, water: 1 }, output: { shark_stew: 1 },
    desc: 'Mengenyangkan sekali masak.'
  },
  hearty_plate: {
    id: 'hearty_plate', name: 'Piring kenyang', icon: '🍽️', category: 'food', type: 'craft',
    requires: { cooked_fish: 1, potato: 2 }, output: { hearty_plate: 1 },
    desc: 'Ikan dan kentang.'
  },
  bandage: {
    id: 'bandage', name: 'Perban', icon: '🩹', category: 'survival', type: 'craft',
    requires: { palm_leaf: 2, rope: 1 }, output: { bandage: 1 },
    desc: 'Obati luka ringan.'
  },
  biofuel: {
    id: 'biofuel', name: 'Biofuel', icon: '🛢️', category: 'resources', type: 'craft',
    requires: { palm_leaf: 3, plank: 1 }, output: { biofuel: 1 },
    desc: 'Fuel for bio engines.'
  },
  engine_bio: {
    id: 'engine_bio', name: 'Bio Engine', icon: '⚙️', category: 'structure', type: 'build',
    requires: { scrap: 4, plank: 4, rope: 2 }, output: null, locked: false,
    desc: 'Burns biofuel to push the raft.'
  },
  engine_elec: {
    id: 'engine_elec', name: 'Electric Engine', icon: '🔋', category: 'structure', type: 'build',
    requires: { metal_ingot: 3, scrap: 4, plastic: 2 }, output: null, locked: true,
    desc: 'Quiet thrust. Needs power.'
  },
  helm: {
    id: 'helm', name: 'Helm', icon: '🧭', category: 'structure', type: 'build',
    requires: { plank: 4, rope: 2, scrap: 1 }, output: null, locked: false,
    desc: 'Steer the raft. E to set heading.'
  },
  control_panel: {
    id: 'control_panel', name: 'Control Panel', icon: '🎛️', category: 'structure', type: 'build',
    requires: { scrap: 3, plastic: 2, metal_ingot: 1 }, output: null, locked: true,
    desc: 'Toggle all engines. E on/off.'
  },
  biofuel_refiner: {
    id: 'biofuel_refiner', name: 'Biofuel Refiner', icon: '🏭', category: 'structure', type: 'build',
    requires: { scrap: 3, plank: 4, plastic: 2 }, output: null, locked: false,
    desc: 'Palm leaves → biofuel.'
  },
  antenna: {
    id: 'antenna', name: 'Antenna', icon: '📡', category: 'structure', type: 'build',
    requires: { scrap: 2, plastic: 2, rope: 1 }, output: null, locked: false,
    desc: 'Extends radio range.'
  },
  radio_receiver: {
    id: 'radio_receiver', name: 'Radio', icon: '📻', category: 'structure', type: 'build',
    requires: { scrap: 3, plastic: 3, metal_ingot: 1 }, output: null, locked: true,
    desc: 'Track the next story island.'
  }
};

export const CATEGORIES = [
  { id: 'resources', icon: '🪵', name: 'Bahan' },
  { id: 'tools', icon: '🔨', name: 'Alat' },
  { id: 'food', icon: '🍲', name: 'Makanan' },
  { id: 'survival', icon: '💧', name: 'Bertahan' },
  { id: 'structure', icon: '🏠', name: 'Bangunan', catalog: true },
];

export const RESEARCH_COSTS = {
  crop_plot: 3,
  large_storage: 4,
  sail: 5,
  smelter: 6,
  engine_elec: 5,
  control_panel: 4,
  radio_receiver: 4
};

for (const r of Object.values(RECIPES)) {
  delete r.name;
  delete r.desc;
  Object.defineProperties(r, {
    name: { get: () => t([`recipe.${r.id}`, `item.${r.id}`, r.id]), configurable: true, enumerable: true },
    desc: { get: () => t([`recipe.${r.id}.desc`, '']), configurable: true, enumerable: true },
  });
}
for (const c of CATEGORIES) {
  const fallback = c.name;
  delete c.name;
  Object.defineProperty(c, 'name', {
    get: () => t([`cat.${c.id}`, fallback || c.id]),
    configurable: true,
    enumerable: true,
  });
}
