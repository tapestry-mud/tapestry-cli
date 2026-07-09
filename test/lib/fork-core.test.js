'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeYaml, readYaml } = require('../../src/util/yaml');
const { rekeyContent, rekeyArea, buildForkPack } = require('../../src/lib/fork-core');

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fork-core-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

// ---- rekeyContent ----

describe('rekeyContent', () => {
  it('replaces originNs: prefix in a plain string', () => {
    expect(rekeyContent('tapestry-core:room-1', 'tapestry-core', 'mallek-core-fork'))
      .toBe('mallek-core-fork:room-1');
  });

  it('leaves strings without the prefix unchanged', () => {
    expect(rekeyContent('other-ns:room-1', 'tapestry-core', 'mallek-core-fork'))
      .toBe('other-ns:room-1');
  });

  it('leaves strings that do not contain a colon unchanged', () => {
    expect(rekeyContent('plain-string', 'tapestry-core', 'mallek-core-fork'))
      .toBe('plain-string');
  });

  it('recurses into plain objects', () => {
    expect(rekeyContent(
      { id: 'tapestry-core:r1', name: 'The Square', area: 'tapestry-core:hall' },
      'tapestry-core', 'mallek-core-fork'
    )).toEqual({ id: 'mallek-core-fork:r1', name: 'The Square', area: 'mallek-core-fork:hall' });
  });

  it('recurses into arrays', () => {
    expect(rekeyContent(
      ['tapestry-core:r1', 'other-ns:r2', 42],
      'tapestry-core', 'mallek-core-fork'
    )).toEqual(['mallek-core-fork:r1', 'other-ns:r2', 42]);
  });

  it('passes through numbers and booleans unchanged', () => {
    expect(rekeyContent(42, 'tapestry-core', 'mallek-core-fork')).toBe(42);
    expect(rekeyContent(true, 'tapestry-core', 'mallek-core-fork')).toBe(true);
    expect(rekeyContent(null, 'tapestry-core', 'mallek-core-fork')).toBe(null);
  });
});

// ---- rekeyArea ----

function seedAreaFiles(ns, areaName = 'the-hall') {
  const roomsDir = path.join(tmp, 'areas', areaName, 'rooms');
  fs.mkdirSync(roomsDir, { recursive: true });
  writeYaml(path.join(roomsDir, 'r1.yaml'), { id: `${ns}:r1`, area: areaName, name: 'Room 1' });
  writeYaml(path.join(roomsDir, 'r2.yaml'), { id: `${ns}:r2`, area: areaName, name: 'Room 2' });
  return roomsDir;
}

function seedMobFiles(ns, areaName = 'the-hall') {
  const mobsDir = path.join(tmp, 'areas', areaName, 'mobs');
  fs.mkdirSync(mobsDir, { recursive: true });
  writeYaml(path.join(mobsDir, 'goblin.yaml'), {
    id: `${ns}:goblin`, area: areaName, name: 'Goblin',
  });
  return mobsDir;
}

describe('rekeyArea', () => {
  it('re-keys room yaml ids', () => {
    seedAreaFiles('tapestry-core');
    rekeyArea(tmp, 'tapestry-core', 'mallek-core-fork');
    expect(readYaml(path.join(tmp, 'areas', 'the-hall', 'rooms', 'r1.yaml')).id)
      .toBe('mallek-core-fork:r1');
    expect(readYaml(path.join(tmp, 'areas', 'the-hall', 'rooms', 'r2.yaml')).id)
      .toBe('mallek-core-fork:r2');
  });

  it('re-keys mob yaml ids when present', () => {
    seedAreaFiles('tapestry-core');
    seedMobFiles('tapestry-core');
    rekeyArea(tmp, 'tapestry-core', 'mallek-core-fork');
    expect(readYaml(path.join(tmp, 'areas', 'the-hall', 'mobs', 'goblin.yaml')).id)
      .toBe('mallek-core-fork:goblin');
  });

  it('leaves non-namespaced strings in yaml files unchanged', () => {
    seedAreaFiles('tapestry-core');
    rekeyArea(tmp, 'tapestry-core', 'mallek-core-fork');
    expect(readYaml(path.join(tmp, 'areas', 'the-hall', 'rooms', 'r1.yaml')).name)
      .toBe('Room 1');
  });

  it('is a no-op when areas/ does not exist', () => {
    expect(() => rekeyArea(tmp, 'tapestry-core', 'mallek-core-fork')).not.toThrow();
  });
});

// ---- buildForkPack ----

function seedSideCar(ns = 'tapestry-core', areaName = 'village-green') {
  const roomsDir = path.join(tmp, 'data', 'areas', areaName, 'rooms');
  fs.mkdirSync(roomsDir, { recursive: true });
  writeYaml(path.join(roomsDir, 'square.yaml'), {
    id: `${ns}:square`, area: areaName, name: 'The Square', description: 'x',
  });
}

describe('buildForkPack', () => {
  it('writes correct pack.yaml: name, version 0.1.0, provenance description, dependencies', () => {
    seedSideCar();
    const buildDir = path.join(tmp, 'fork-build');
    buildForkPack(buildDir, {
      gameRoot: tmp, area: 'village-green',
      originNamespace: 'tapestry-core', originVersion: '1.2.3',
      originPackName: '@tapestry/core',
      forkPackName: '@mallek/core-fork',
    });
    const manifest = readYaml(path.join(buildDir, 'pack.yaml'));
    expect(manifest.name).toBe('@mallek/core-fork');
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.type).toBe('world');
    expect(manifest.description).toBe('derivative of @tapestry/core@1.2.3');
    // caret of major.minor.0 (SA2)
    expect(manifest.dependencies).toEqual({ '@tapestry/core': '^1.2.0' });
  });

  it('renders the area content into the build dir', () => {
    seedSideCar();
    const buildDir = path.join(tmp, 'fork-build');
    buildForkPack(buildDir, {
      gameRoot: tmp, area: 'village-green',
      originNamespace: 'tapestry-core', originVersion: '1.2.3',
      originPackName: '@tapestry/core',
      forkPackName: '@mallek/core-fork',
    });
    expect(fs.existsSync(path.join(buildDir, 'areas', 'village-green', 'rooms', 'square.yaml')))
      .toBe(true);
  });

  it('re-keys all room ids to the fork namespace', () => {
    seedSideCar();
    const buildDir = path.join(tmp, 'fork-build');
    buildForkPack(buildDir, {
      gameRoot: tmp, area: 'village-green',
      originNamespace: 'tapestry-core', originVersion: '1.2.3',
      originPackName: '@tapestry/core',
      forkPackName: '@mallek/core-fork',
    });
    const room = readYaml(path.join(buildDir, 'areas', 'village-green', 'rooms', 'square.yaml'));
    expect(room.id).toBe('mallek-core-fork:square');
  });

  it('ensures content globs are present in pack.yaml', () => {
    seedSideCar();
    const buildDir = path.join(tmp, 'fork-build');
    buildForkPack(buildDir, {
      gameRoot: tmp, area: 'village-green',
      originNamespace: 'tapestry-core', originVersion: '1.2.3',
      originPackName: '@tapestry/core',
      forkPackName: '@mallek/core-fork',
    });
    const manifest = readYaml(path.join(buildDir, 'pack.yaml'));
    expect(manifest.content).toBeDefined();
    expect(manifest.content.rooms).toBe('areas/**/rooms/*.yaml');
  });

  it('returns { forkNamespace, files, version }', () => {
    seedSideCar();
    const buildDir = path.join(tmp, 'fork-build');
    const result = buildForkPack(buildDir, {
      gameRoot: tmp, area: 'village-green',
      originNamespace: 'tapestry-core', originVersion: '1.2.3',
      originPackName: '@tapestry/core',
      forkPackName: '@mallek/core-fork',
    });
    expect(result.forkNamespace).toBe('mallek-core-fork');
    expect(Array.isArray(result.files)).toBe(true);
    expect(result.files).toContain('square.yaml');
    expect(result.version).toBe('0.1.0');
  });

  it('handles a 0.x origin version with caret-minor.0 dep (SA2)', () => {
    seedSideCar();
    const buildDir = path.join(tmp, 'fork-build');
    buildForkPack(buildDir, {
      gameRoot: tmp, area: 'village-green',
      originNamespace: 'tapestry-core', originVersion: '0.1.44',
      originPackName: '@tapestry/core',
      forkPackName: '@mallek/core-fork',
    });
    const manifest = readYaml(path.join(buildDir, 'pack.yaml'));
    // ^0.1.0 not ^0.1.44 (SA2: caret of major.minor.0)
    expect(manifest.dependencies['@tapestry/core']).toBe('^0.1.0');
    // Description preserves the full version for human readability
    expect(manifest.description).toBe('derivative of @tapestry/core@0.1.44');
  });

  it('uses originPackName for dependencies and provenance, not a derived form (F5)', () => {
    seedSideCar();
    const buildDir = path.join(tmp, 'fork-build');
    buildForkPack(buildDir, {
      gameRoot: tmp, area: 'village-green',
      originNamespace: 'my-org-core', originVersion: '2.0.0',
      originPackName: '@my-org/core',
      forkPackName: '@mallek/org-core-fork',
    });
    const manifest = readYaml(path.join(buildDir, 'pack.yaml'));
    // Must use the passed originPackName, NOT namespaceToName('my-org-core') which would
    // give '@my/org-core' (a lossy split on the first dash).
    expect(manifest.dependencies['@my-org/core']).toBe('^2.0.0');
    expect(manifest.description).toBe('derivative of @my-org/core@2.0.0');
  });
});
