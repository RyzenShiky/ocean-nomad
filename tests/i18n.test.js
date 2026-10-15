import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import en from '../src/i18n/en.js';
import id from '../src/i18n/id.js';

const ph = s => (String(s).match(/\{\w+\}/g) || []).sort().join();
describe('i18n', () => {
  it('en and id same keys and placeholders', () => {
    assert.deepEqual(Object.keys(en).sort(), Object.keys(id).sort());
    for (const k of Object.keys(en)) assert.equal(ph(en[k]), ph(id[k]), k);
  });
});
