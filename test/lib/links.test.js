'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { readLinks, writeLinks, addLink, removeLink, LINKS_FILE } = require('../../src/lib/links');

let tmpDir;
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tapestry-links-')); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true }); });

describe('links file I/O', () => {
  it('returns empty links when no file exists', () => {
    expect(readLinks(tmpDir)).toEqual({ version: 1, links: {} });
  });

  it('addLink writes a name -> path entry', () => {
    addLink(tmpDir, '@mallek/legends-forgotten', 'D:/Skunkworks/legends-forgotten');
    expect(readLinks(tmpDir).links).toEqual({ '@mallek/legends-forgotten': 'D:/Skunkworks/legends-forgotten' });
    expect(fs.existsSync(path.join(tmpDir, LINKS_FILE))).toBe(true);
  });

  it('addLink updates an existing name (idempotent path swap)', () => {
    addLink(tmpDir, '@mallek/lf', '/a');
    addLink(tmpDir, '@mallek/lf', '/b');
    expect(readLinks(tmpDir).links['@mallek/lf']).toBe('/b');
  });

  it('removeLink deletes the entry and returns true; false when absent', () => {
    addLink(tmpDir, '@mallek/lf', '/a');
    expect(removeLink(tmpDir, '@mallek/lf')).toBe(true);
    expect(readLinks(tmpDir).links).toEqual({});
    expect(removeLink(tmpDir, '@mallek/lf')).toBe(false);
  });
});

const {
  readPackManifest, packLinkPath, containerPackTarget, dockerLinkMounts,
} = require('../../src/lib/links');

describe('manifest + path helpers', () => {
  it('readPackManifest reads pack.yaml', () => {
    const dir = path.join(tmpDir, 'lf');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'pack.yaml'), 'name: "@mallek/legends-forgotten"\nversion: "0.1.3"\n');
    expect(readPackManifest(dir).name).toBe('@mallek/legends-forgotten');
  });

  it('readPackManifest falls back to tapestry.yaml', () => {
    const dir = path.join(tmpDir, 'p');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'tapestry.yaml'), 'name: "@x/y"\n');
    expect(readPackManifest(dir).name).toBe('@x/y');
  });

  it('readPackManifest throws when neither manifest exists', () => {
    const dir = path.join(tmpDir, 'empty');
    fs.mkdirSync(dir);
    expect(() => readPackManifest(dir)).toThrow('not a pack');
  });

  it('packLinkPath splits scoped names into packs/@scope/name', () => {
    expect(packLinkPath('/proj', '@mallek/legends-forgotten'))
      .toBe(path.join('/proj', 'packs', '@mallek', 'legends-forgotten'));
  });

  it('containerPackTarget builds a forward-slash /app/packs path', () => {
    expect(containerPackTarget('@mallek/legends-forgotten'))
      .toBe('/app/packs/@mallek/legends-forgotten');
  });

  it('dockerLinkMounts returns flattened -v args for each link', () => {
    addLink(tmpDir, '@mallek/lf', '/host/lf');
    expect(dockerLinkMounts(tmpDir))
      .toEqual(['-v', '/host/lf:/app/packs/@mallek/lf']);
  });
});
