export const STATIONS = {
  simple_grill: {
    id: 'simple_grill',
    in: 'raw_fish',
    altIn: 'raw_shark',
    out: 'cooked_fish',
    altOut: 'cooked_shark',
    fuel: 'plank',
    cookTime: 12,
    fuelPerBatch: 1,
    maxInput: 4
  },
  smelter: {
    id: 'smelter',
    in: 'scrap',
    out: 'metal_ingot',
    fuel: 'plank',
    cookTime: 15,
    fuelPerBatch: 1,
    maxInput: 4,
    inPerBatch: 3
  },
  purifier: {
    id: 'purifier',
    in: 'salt_water',
    out: 'water',
    fuel: 'plank',
    cookTime: 10,
    fuelPerBatch: 1,
    maxInput: 4
  },
  biofuel_refiner: {
    id: 'biofuel_refiner',
    in: 'palm_leaf',
    out: 'biofuel',
    fuel: 'plank',
    cookTime: 14,
    fuelPerBatch: 1,
    maxInput: 6,
    inPerBatch: 3
  }
};

export function createStationState(typeId) {
  return { id: typeId, input: 0, inputId: null, fuel: 0, output: 0, outputId: null, progress: 0, cooking: false };
}

export function tickStation(s, dt) {
  const def = STATIONS[s.id];
  if (!def) return;
  if (s.input > 0 && s.fuel > 0) {
    s.cooking = true;
    s.progress += dt;
    if (s.progress >= def.cookTime) {
      s.progress = 0;
      const need = def.inPerBatch || 1;
      if (s.input < need) { s.cooking = false; return; }
      s.input -= need;
      s.output++;
      s.outputId = s.inputId === def.altIn ? (def.altOut || def.out) : def.out;
      s.fuel = Math.max(0, s.fuel - def.fuelPerBatch);
      if (s.input <= 0 || s.fuel <= 0) s.cooking = false;
    }
  } else {
    s.cooking = false;
  }
}
