'use strict';

const { generatePackFiles } = require('../../src/scaffold/templates');

const parsed = { scopedName: '@author/my-pack', shortName: 'my-pack', scope: 'author' };

test('returns exactly 8 files', () => {
  const files = generatePackFiles(parsed);
  expect(files).toHaveLength(8);
});

test('returns all expected file paths', () => {
  const paths = generatePackFiles(parsed).map(f => f.path);
  expect(paths).toContain('pack.yaml');
  expect(paths).toContain('tags.yml');
  expect(paths).toContain('areas/example-area/area.yaml');
  expect(paths).toContain('areas/example-area/rooms/town-square.yaml');
  expect(paths).toContain('areas/example-area/mobs/guard.yaml');
  expect(paths).toContain('areas/example-area/items/lantern.yaml');
  expect(paths).toContain('scripts/init.js');
  expect(paths).toContain('help/example.yaml');
});

test('pack.yaml contains the scoped pack name', () => {
  const files = generatePackFiles(parsed);
  const manifest = files.find(f => f.path === 'pack.yaml');
  expect(manifest.content).toContain('@author/my-pack');
});

test('room yaml uses shortName for entity IDs', () => {
  const files = generatePackFiles(parsed);
  const room = files.find(f => f.path === 'areas/example-area/rooms/town-square.yaml');
  expect(room.content).toContain('my-pack:town-square');
});

test('mob yaml uses shortName for entity IDs', () => {
  const files = generatePackFiles(parsed);
  const mob = files.find(f => f.path === 'areas/example-area/mobs/guard.yaml');
  expect(mob.content).toContain('my-pack:');
});

test('every file has non-empty content', () => {
  const files = generatePackFiles(parsed);
  for (const file of files) {
    expect(file.content.length).toBeGreaterThan(0);
  }
});

const yaml = require('js-yaml');

describe('scaffold pack.yaml content globs', () => {
  it('declares area_definitions (the key the engine reads), not areas', () => {
    const files = generatePackFiles({ scopedName: '@x/y', shortName: 'y' });
    const pkg = files.find((f) => f.path === 'pack.yaml');
    const manifest = yaml.load(pkg.content);
    expect(manifest.content.area_definitions).toBe('areas/**/area.yaml');
    expect(manifest.content.areas).toBeUndefined();
  });
});
