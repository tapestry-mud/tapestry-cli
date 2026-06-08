'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeYaml } = require('../../src/util/yaml');
const { parseAreaRef, packNamespace, detectPackDir, resolvePackDirOrNull } = require('../../src/lib/pack-resolve');

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-resolve-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function seedLinkedPack() {
  const packDir = path.join(tmp, 'packs', '@legends', 'forgotten');
  fs.mkdirSync(packDir, { recursive: true });
  writeYaml(path.join(packDir, 'pack.yaml'), { name: '@legends/forgotten', version: '0.1.0' });
  writeYaml(path.join(tmp, 'tapestry-links.yaml'), { version: 1, links: { '@legends/forgotten': packDir } });
  return packDir;
}

describe('parseAreaRef', () => {
  it('splits namespace:area', () => {
    expect(parseAreaRef('legends-forgotten:lf-hollow')).toEqual({ namespace: 'legends-forgotten', area: 'lf-hollow' });
  });
  it('throws on a missing colon', () => {
    expect(() => parseAreaRef('lf-hollow')).toThrow(/namespace:area-id/i);
  });
});

describe('packNamespace', () => {
  it('flattens a scoped name', () => {
    expect(packNamespace('@legends/forgotten')).toBe('legends-forgotten');
  });
});

describe('resolvePackDirOrNull', () => {
  it('returns the linked pack matching the namespace', () => {
    const packDir = seedLinkedPack();
    expect(resolvePackDirOrNull(tmp, 'legends-forgotten')).toBe(packDir);
  });
  it('returns null when no pack matches (hobbyist case)', () => {
    expect(resolvePackDirOrNull(tmp, 'nobody-home')).toBeNull();
  });
});

describe('detectPackDir', () => {
  it('throws when no pack matches', () => {
    expect(() => detectPackDir(tmp, 'nobody-home')).toThrow(/could not auto-detect/i);
  });
});
