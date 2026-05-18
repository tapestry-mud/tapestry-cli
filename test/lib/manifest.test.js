'use strict';

const { PACK_MANIFEST } = require('../../src/lib/manifest');

test('PACK_MANIFEST is pack.yaml', () => {
  expect(PACK_MANIFEST).toBe('pack.yaml');
});
