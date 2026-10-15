import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { on, emit } from '../src/sim/bus.js';
import { SaveCoordinator } from '../src/core/SaveCoordinator.js';
import { createRng } from '../src/sim/rng.js';

describe('smoke', () => {
  it('bus on/emit works without DOM', () => {
    let hit = false;
    on('test-smoke', () => { hit = true; });
    emit('test-smoke');
    assert.equal(hit, true);
  });

  it('SaveCoordinator module loads', () => {
    const sc = new SaveCoordinator(null);
    assert.equal(typeof sc.hasAny, 'function');
    assert.equal(typeof sc.listSlots, 'function');
  });

  it('rng still deterministic', () => {
    const a = createRng(99);
    const b = createRng(99);
    assert.equal(a(), b());
  });
});
