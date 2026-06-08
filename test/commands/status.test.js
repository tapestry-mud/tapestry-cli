'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeYaml } = require('../../src/util/yaml');
const { status } = require('../../src/commands/status');

let tmp, logs;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'status-'));
  logs = [];
  jest.spyOn(console, 'log').mockImplementation((m) => logs.push(String(m)));
});
afterEach(() => {
  console.log.mockRestore();
  fs.rmSync(tmp, { recursive: true, force: true });
});

it('prints a row per authored area with its state', () => {
  const dir = path.join(tmp, 'data', 'areas', 'lf-hollow', 'rooms');
  fs.mkdirSync(dir, { recursive: true });
  writeYaml(path.join(dir, 'lf-hollow-1.yaml'), { id: 'tapestry-core:lf-hollow-1', area: 'lf-hollow', name: 'R' });
  status({ cwd: tmp, gameRoot: tmp });
  const out = logs.join('\n');
  expect(out).toMatch(/Fork/);
  expect(out).toMatch(/lf-hollow/);
  expect(out).toMatch(/lighter on-host view/i);
});

it('reports nothing when there are no authored areas', () => {
  status({ cwd: tmp, gameRoot: tmp });
  expect(logs.join('\n')).toMatch(/no authored areas/i);
});
