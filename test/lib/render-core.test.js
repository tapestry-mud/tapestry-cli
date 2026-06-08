'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeYaml, readYaml } = require('../../src/util/yaml');
const { renderArea, removeSideCars, reconcileDependencies } = require('../../src/lib/render-core');

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'render-core-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function seedSideCar() {
  const dir = path.join(tmp, 'data', 'areas', 'lf-hollow', 'rooms');
  fs.mkdirSync(dir, { recursive: true });
  writeYaml(path.join(dir, 'lf-hollow-anchor.yaml'), {
    id: 'legends-forgotten:lf-hollow-anchor', area: 'lf-hollow', name: 'Anchor', description: 'x',
  });
}

function seedTargetPack() {
  const packDir = path.join(tmp, 'pack');
  fs.mkdirSync(packDir, { recursive: true });
  writeYaml(path.join(packDir, 'pack.yaml'), { name: '@legends/forgotten', version: '0.1.0' });
  return packDir;
}

it('renders rooms + synthesizes area.yaml + wires globs into the target dir', () => {
  seedSideCar();
  const packDir = seedTargetPack();
  const { written, files } = renderArea(packDir, { gameRoot: tmp, area: 'lf-hollow' });
  expect(written).toBe(1);
  expect(files).toEqual(['lf-hollow-anchor.yaml']);
  expect(fs.existsSync(path.join(packDir, 'areas', 'lf-hollow', 'rooms', 'lf-hollow-anchor.yaml'))).toBe(true);
  const area = readYaml(path.join(packDir, 'areas', 'lf-hollow', 'area.yaml'));
  expect(area.area.id).toBe('lf-hollow');
  expect(area.area.level_range).toEqual([1, 99]);
  const m = readYaml(path.join(packDir, 'pack.yaml'));
  expect(m.content.area_definitions).toBe('areas/**/area.yaml');
  expect(m.content.rooms).toBe('areas/**/rooms/*.yaml');
});

it('throws when no authored rooms exist', () => {
  const packDir = seedTargetPack();
  expect(() => renderArea(packDir, { gameRoot: tmp, area: 'lf-hollow' })).toThrow(/no authored rooms/i);
});

it('enforces the divergence guard and honors force', () => {
  seedSideCar();
  const packDir = seedTargetPack();
  const dest = path.join(packDir, 'areas', 'lf-hollow', 'rooms', 'lf-hollow-anchor.yaml');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  writeYaml(dest, { id: 'legends-forgotten:lf-hollow-anchor', name: 'HAND EDITED' });
  expect(() => renderArea(packDir, { gameRoot: tmp, area: 'lf-hollow' })).toThrow(/diverge|--force/i);
  expect(() => renderArea(packDir, { gameRoot: tmp, area: 'lf-hollow', force: true })).not.toThrow();
});

it('reconcileDependencies is a no-op for rooms-only content (designed-in seam)', () => {
  const packDir = seedTargetPack();
  expect(reconcileDependencies(packDir, 'lf-hollow')).toEqual([]);
  // The seam must NOT have written a dependencies block for rooms.
  expect(readYaml(path.join(packDir, 'pack.yaml')).dependencies).toBeUndefined();
});

it('removeSideCars deletes the area side-cars and prunes empty dirs', () => {
  seedSideCar();
  removeSideCars(tmp, 'lf-hollow', ['lf-hollow-anchor.yaml']);
  expect(fs.existsSync(path.join(tmp, 'data', 'areas', 'lf-hollow'))).toBe(false);
});
