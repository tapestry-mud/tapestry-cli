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

  it('preserves unrelated manifest keys', () => {
    writeManifest({ name: '@x/y', version: '0.1.0', type: 'world', tags: 'tags.yml' });
    ensureContentGlobs(tmp);
    const m = readYaml(path.join(tmp, 'pack.yaml'));
    expect(m.type).toBe('world');
    expect(m.tags).toBe('tags.yml');
  });
});
