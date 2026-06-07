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

function seedSideCarAreaYaml(envelope) {
  const dir = path.join(tmp, 'data', 'areas', 'lf-hollow');
  fs.mkdirSync(dir, { recursive: true });
  writeYaml(path.join(dir, 'area.yaml'), envelope);
}

describe('area.yaml handling', () => {
  it('copies the side-car area.yaml through verbatim (envelope + Spec A fields)', () => {
    seedSideCar();
    const packDir = seedLinkedPack();
    const envelope = { area: { id: 'lf-hollow', name: 'The Hollow', theme: 'dread', lore: 'old', level_range: [3, 7], reset_interval: 600 } };
    seedSideCarAreaYaml(envelope);
    syncArea('legends-forgotten:lf-hollow', { gameRoot: tmp, cwd: tmp, keepSidecars: true });
    const out = readYaml(path.join(packDir, 'areas', 'lf-hollow', 'area.yaml'));
    expect(out).toEqual(envelope);
  });

  it('synthesizes a valid area: envelope when no area.yaml exists anywhere', () => {
    seedSideCar();
    const packDir = seedLinkedPack();
    syncArea('legends-forgotten:lf-hollow', { gameRoot: tmp, cwd: tmp, keepSidecars: true });
    const out = readYaml(path.join(packDir, 'areas', 'lf-hollow', 'area.yaml'));
    expect(out.area.id).toBe('lf-hollow');
    expect(out.area.level_range).toEqual([1, 99]);
    expect(out.area.reset_interval).toBe(300);
    expect(out.id).toBeUndefined(); // not the old flat stub
  });

  it('leaves the pack area.yaml untouched when the side-car has none', () => {
    seedSideCar();
    const packDir = seedLinkedPack();
    const existing = { area: { id: 'lf-hollow', name: 'Pack Owned', reset_interval: 999 } };
    fs.mkdirSync(path.join(packDir, 'areas', 'lf-hollow'), { recursive: true });
    writeYaml(path.join(packDir, 'areas', 'lf-hollow', 'area.yaml'), existing);
    syncArea('legends-forgotten:lf-hollow', { gameRoot: tmp, cwd: tmp, keepSidecars: true });
    expect(readYaml(path.join(packDir, 'areas', 'lf-hollow', 'area.yaml'))).toEqual(existing);
  });

  it('overwrites a stale pack area.yaml when the side-car area.yaml is present', () => {
    seedSideCar();
    const packDir = seedLinkedPack();
    // Pre-existing stale pack area.yaml...
    fs.mkdirSync(path.join(packDir, 'areas', 'lf-hollow'), { recursive: true });
    writeYaml(path.join(packDir, 'areas', 'lf-hollow', 'area.yaml'), { area: { id: 'lf-hollow', name: 'STALE', reset_interval: 1 } });
    // ...and a fresh authored side-car area.yaml that should win.
    const fresh = { area: { id: 'lf-hollow', name: 'Fresh Hollow', theme: 'bright', reset_interval: 600 } };
    seedSideCarAreaYaml(fresh);
    syncArea('legends-forgotten:lf-hollow', { gameRoot: tmp, cwd: tmp, keepSidecars: true });
    expect(readYaml(path.join(packDir, 'areas', 'lf-hollow', 'area.yaml'))).toEqual(fresh);
  });
});

describe('manifest glob reconcile', () => {
  it('wires both content globs into a glob-less pack manifest', () => {
    seedSideCar();
    const packDir = seedLinkedPack(); // pack.yaml has no content block
    syncArea('legends-forgotten:lf-hollow', { gameRoot: tmp, cwd: tmp, keepSidecars: true });
    const m = readYaml(path.join(packDir, 'pack.yaml'));
    expect(m.content.area_definitions).toBe('areas/**/area.yaml');
    expect(m.content.rooms).toBe('areas/**/rooms/*.yaml');
  });
});

describe('namespace guard', () => {
  it('refuses to sync into a pack whose namespace differs from the area ref', () => {
    seedSideCar();
    // Linked pack is @legends/forgotten (ns: legends-forgotten), but we target a different ns.
    const packDir = path.join(tmp, 'other-pack');
    fs.mkdirSync(packDir, { recursive: true });
    writeYaml(path.join(packDir, 'pack.yaml'), { name: '@someone/elsewhere', version: '0.1.0' });
    expect(() =>
      syncArea('legends-forgotten:lf-hollow', { gameRoot: tmp, cwd: tmp, pack: packDir, keepSidecars: true })
    ).toThrow(/namespace .* does not match/i);
  });
});
