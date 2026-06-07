'use strict';

jest.mock('../../src/lib/git', () => ({ isRepo: jest.fn(() => true), commitAll: jest.fn() }));

const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeYaml, readYaml } = require('../../src/util/yaml');
const { isRepo, commitAll } = require('../../src/lib/git');
const { syncArea } = require('../../src/commands/sync-area');

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-area-'));
  isRepo.mockReturnValue(true);
  commitAll.mockReset();
});
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function seedSideCar() {
  const dir = path.join(tmp, 'data', 'areas', 'lf-hollow', 'rooms');
  fs.mkdirSync(dir, { recursive: true });
  writeYaml(path.join(dir, 'lf-hollow-anchor.yaml'), {
    id: 'legends-forgotten:lf-hollow-anchor',
    area: 'lf-hollow',
    name: 'Anchor',
    description: 'The anchor room.',
    exits: { north: 'legends-forgotten:lf-hollow-1' }
  });
}

function seedLinkedPack() {
  const packDir = path.join(tmp, 'packs', '@legends', 'forgotten');
  fs.mkdirSync(packDir, { recursive: true });
  writeYaml(path.join(packDir, 'pack.yaml'), { name: '@legends/forgotten', version: '0.1.0' });
  writeYaml(path.join(tmp, 'tapestry-links.yaml'), {
    version: 1,
    links: { '@legends/forgotten': packDir }
  });
  return packDir;
}

it('exports side-car rooms into the auto-detected pack', () => {
  seedSideCar();
  const packDir = seedLinkedPack();
  syncArea('legends-forgotten:lf-hollow', { gameRoot: tmp, cwd: tmp, keepSidecars: true });
  const out = path.join(packDir, 'areas', 'lf-hollow', 'rooms', 'lf-hollow-anchor.yaml');
  expect(fs.existsSync(out)).toBe(true);
  expect(readYaml(out).id).toBe('legends-forgotten:lf-hollow-anchor');
});

it('scaffolds area.yaml when absent', () => {
  seedSideCar();
  const packDir = seedLinkedPack();
  syncArea('legends-forgotten:lf-hollow', { gameRoot: tmp, cwd: tmp, keepSidecars: true });
  expect(fs.existsSync(path.join(packDir, 'areas', 'lf-hollow', 'area.yaml'))).toBe(true);
});

it('throws when no side-car area exists', () => {
  seedLinkedPack();
  expect(() => syncArea('legends-forgotten:lf-hollow', { gameRoot: tmp, cwd: tmp, keepSidecars: true }))
    .toThrow(/no authored rooms/i);
});

it('refuses to clobber a diverging pack file without force', () => {
  seedSideCar();
  const packDir = seedLinkedPack();
  const out = path.join(packDir, 'areas', 'lf-hollow', 'rooms', 'lf-hollow-anchor.yaml');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeYaml(out, { id: 'legends-forgotten:lf-hollow-anchor', name: 'HAND EDITED', description: 'x' });
  expect(() => syncArea('legends-forgotten:lf-hollow', { gameRoot: tmp, cwd: tmp, keepSidecars: true }))
    .toThrow(/diverge|--force/i);
  expect(() => syncArea('legends-forgotten:lf-hollow', { gameRoot: tmp, cwd: tmp, force: true, keepSidecars: true }))
    .not.toThrow();
});
