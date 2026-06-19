'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { types } = require('../../src/commands/types');

test('types writes the engine .d.ts into <cwd>/types', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'tap-types-'));
  types({ cwd });
  const out = path.join(cwd, 'types', 'tapestry-engine.d.ts');
  expect(fs.existsSync(out)).toBe(true);
  expect(fs.readFileSync(out, 'utf8')).toContain('declare module "@tapestry/engine"');
});
