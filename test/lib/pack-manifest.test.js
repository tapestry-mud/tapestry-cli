'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { readYaml, writeYaml } = require('../../src/util/yaml');
const { ensureContentGlobs } = require('../../src/lib/pack-manifest');

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-manifest-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function writeManifest(data) { writeYaml(path.join(tmp, 'pack.yaml'), data); }

describe('ensureContentGlobs', () => {
  it('adds both globs when the content block is absent', () => {
    writeManifest({ name: '@x/y', version: '0.1.0' });
    const added = ensureContentGlobs(tmp);
    expect(added.sort()).toEqual(['area_definitions', 'rooms']);
    const m = readYaml(path.join(tmp, 'pack.yaml'));
    expect(m.content.area_definitions).toBe('areas/**/area.yaml');
    expect(m.content.rooms).toBe('areas/**/rooms/*.yaml');
  });

  it('leaves an existing glob value untouched and reports nothing added', () => {
    writeManifest({
      name: '@x/y', version: '0.1.0',
      content: { area_definitions: 'custom/area.yaml', rooms: 'areas/**/rooms/*.yaml' },
    });
    const added = ensureContentGlobs(tmp);
    expect(added).toEqual([]);
    const m = readYaml(path.join(tmp, 'pack.yaml'));
    expect(m.content.area_definitions).toBe('custom/area.yaml');
  });

  it('adds only missing globs when rooms is already present', () => {
    writeManifest({
      name: '@x/y', version: '0.1.0',
      content: { rooms: 'custom/rooms/*.yaml' },
    });
    const added = ensureContentGlobs(tmp);
    expect(added).toEqual(['area_definitions']);
    const m = readYaml(path.join(tmp, 'pack.yaml'));
    expect(m.content.rooms).toBe('custom/rooms/*.yaml');
    expect(m.content.area_definitions).toBe('areas/**/area.yaml');
  });

  it('preserves unrelated manifest keys', () => {
    writeManifest({ name: '@x/y', version: '0.1.0', type: 'world', tags: 'tags.yml' });
    ensureContentGlobs(tmp);
    const m = readYaml(path.join(tmp, 'pack.yaml'));
    expect(m.type).toBe('world');
    expect(m.tags).toBe('tags.yml');
  });
});

const { bumpVersion } = require('../../src/lib/pack-manifest');

describe('bumpVersion', () => {
  function seed(version) { writeYaml(path.join(tmp, 'pack.yaml'), { name: '@x/y', version }); }

  it('bumps patch by default and returns { old, new }', () => {
    seed('0.3.1');
    const r = bumpVersion(tmp, 'patch');
    expect(r).toEqual({ old: '0.3.1', new: '0.3.2' });
    expect(readYaml(path.join(tmp, 'pack.yaml')).version).toBe('0.3.2');
  });

  it('bumps minor', () => {
    seed('0.3.1');
    expect(bumpVersion(tmp, 'minor')).toEqual({ old: '0.3.1', new: '0.4.0' });
  });

  it('bumps major', () => {
    seed('0.3.1');
    expect(bumpVersion(tmp, 'major')).toEqual({ old: '0.3.1', new: '1.0.0' });
  });

  it('throws on a non-semver version', () => {
    seed('stable');
    expect(() => bumpVersion(tmp, 'patch')).toThrow(/valid semver/i);
  });

  it('uses patch as the default level', () => {
    seed('0.3.1');
    expect(bumpVersion(tmp)).toEqual({ old: '0.3.1', new: '0.3.2' });
  });

  it('throws on an invalid level', () => {
    seed('0.3.1');
    expect(() => bumpVersion(tmp, 'garbage')).toThrow(/invalid bump level/i);
  });
});
