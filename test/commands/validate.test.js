'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeYaml } = require('../../src/util/yaml');
const { validate } = require('../../src/commands/validate');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tapestry-validate-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

function writeManifest(cwd, data) {
  writeYaml(path.join(cwd, 'pack.yaml'), data);
}

const VALID_MANIFEST = {
  name: '@mallek/test-pack',
  version: '1.0.0',
  type: 'module',
  display_name: 'Test Pack',
  description: 'A test pack',
  author: 'Tester',
  license: 'MIT',
  engine: '>=3.0.0',
  validation: 'strict',
};

it('succeeds on a valid manifest', () => {
  writeManifest(tmpDir, VALID_MANIFEST);
  expect(() => validate({ cwd: tmpDir })).not.toThrow();
});

it('throws when pack.yaml is missing', () => {
  expect(() => validate({ cwd: tmpDir })).toThrow('No pack.yaml found');
});

it('throws when name is not scoped', () => {
  writeManifest(tmpDir, { ...VALID_MANIFEST, name: 'bad-name' });
  expect(() => validate({ cwd: tmpDir })).toThrow(/validation error/);
});

it('throws when required field is missing', () => {
  const { description: _d, ...rest } = VALID_MANIFEST;
  writeManifest(tmpDir, rest);
  expect(() => validate({ cwd: tmpDir })).toThrow(/validation error/);
});

it('throws when type is invalid', () => {
  writeManifest(tmpDir, { ...VALID_MANIFEST, type: 'plugin' });
  expect(() => validate({ cwd: tmpDir })).toThrow(/validation error/);
});

it('throws when validation is invalid', () => {
  writeManifest(tmpDir, { ...VALID_MANIFEST, validation: 'none' });
  expect(() => validate({ cwd: tmpDir })).toThrow(/validation error/);
});

it('reports helpful error when engine is an object in pack manifest', () => {
  writeManifest(tmpDir, { ...VALID_MANIFEST, engine: { version: 'stable', mode: 'docker' } });
  const log = jest.spyOn(console, 'log').mockImplementation();
  try {
    expect(() => validate({ cwd: tmpDir })).toThrow(/validation error/);
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('version constraint string');
    expect(output).toContain('tapestry.yaml');
  } finally {
    log.mockRestore();
  }
});

it('gives helpful error when only tapestry.yaml (server manifest) exists', () => {
  writeYaml(path.join(tmpDir, 'tapestry.yaml'), {
    name: 'my-game',
    engine: { version: '3.1.0', mode: 'docker' },
  });
  expect(() => validate({ cwd: tmpDir })).toThrow('No pack.yaml found');
  expect(() => validate({ cwd: tmpDir })).toThrow('server manifest');
});
