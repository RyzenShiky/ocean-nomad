/** Data-driven floating debris kinds */
export const DEBRIS = {
  wood:    { count: 90, y: 0.07, bob: 0.04, drift: 1.0, loot: [['wood', 1, 2, 4], ['plank', 0.3, 1, 1]] },
  barrel:  { count: 28, y: 0.30, bob: 0.05, drift: 1.0, loot: [['plastic', 1, 1, 2], ['scrap', 0.5, 1, 1], ['rope', 0.35, 1, 1], ['food', 0.25, 1, 1], ['water', 0.25, 1, 1]] },
  plastic: { count: 40, y: 0.05, bob: 0.06, drift: 1.2, loot: [['plastic', 1, 1, 2]] },
  scrap:   { count: 24, y: 0.03, bob: 0.03, drift: 0.8, loot: [['scrap', 1, 1, 2], ['metal_ingot', 0.05, 1, 1]] },
  leaf:    { count: 30, y: 0.02, bob: 0.07, drift: 1.4, loot: [['palm_leaf', 1, 1, 2], ['seed', 0.15, 1, 1]] },
  crate:   { count: 10, y: 0.28, bob: 0.05, drift: 0.9, loot: [['plank', 1, 1, 2], ['rope', 0.6, 1, 1], ['food', 0.5, 1, 1], ['water', 0.5, 1, 1]] }
};

export const DEBRIS_KINDS = Object.keys(DEBRIS);
