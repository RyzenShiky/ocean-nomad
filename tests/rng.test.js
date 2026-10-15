import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/sim/rng.js';

describe('createRng', () => {
  it('deterministic for same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    assert.deepEqual(seqA, seqB);
  });
  it('setSeed resets sequence', () => {
    const r = createRng(1);
    const x = r();
    r.setSeed(1);
    assert.equal(r(), x);
  });
});
