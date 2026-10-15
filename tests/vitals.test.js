import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tickVitals, RATES } from '../src/sim/vitals.js';

describe('tickVitals', () => {
  it('drains thirst and hunger', () => {
    const v = { thirst: 100, hunger: 100, health: 100, oxygen: 100 };
    tickVitals(v, 1, RATES);
    assert.ok(v.thirst < 100);
    assert.ok(v.hunger < 100);
  });
  it('returns true when health reaches 0', () => {
    const v = { thirst: 0, hunger: 0, health: 1, oxygen: 100 };
    let dead = false;
    for (let i = 0; i < 50; i++) {
      if (tickVitals(v, 1, { ...RATES, starve: 5 })) dead = true;
    }
    assert.equal(dead, true);
    assert.equal(v.health, 0);
  });
});
