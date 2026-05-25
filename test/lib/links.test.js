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

const {
  materializeLinks, removeMaterializedLink, checkMissingDeps,
} = require('../../src/lib/links');

describe('materialize + dependency check', () => {
  it('materializeLinks creates a symlink/junction at packs/@scope/name', () => {
    const target = path.join(tmpDir, 'lf-src');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'pack.yaml'), 'name: "@mallek/lf"\n');
    addLink(tmpDir, '@mallek/lf', target);

    materializeLinks(tmpDir);

    const linkPath = path.join(tmpDir, 'packs', '@mallek', 'lf');
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(linkPath, 'pack.yaml'))).toBe(true);
  });

  it('materializeLinks throws when a linked path is gone', () => {
    addLink(tmpDir, '@mallek/lf', path.join(tmpDir, 'does-not-exist'));
    expect(() => materializeLinks(tmpDir)).toThrow('no longer exists');
  });

  it('removeMaterializedLink removes the junction but not the target', () => {
    const target = path.join(tmpDir, 'lf-src');
    fs.mkdirSync(target);
    addLink(tmpDir, '@mallek/lf', target);
    materializeLinks(tmpDir);

    removeMaterializedLink(tmpDir, '@mallek/lf');

    expect(fs.existsSync(path.join(tmpDir, 'packs', '@mallek', 'lf'))).toBe(false);
    expect(fs.existsSync(target)).toBe(true);
  });

  it('checkMissingDeps returns deps not present as install dir or link', () => {
    const manifest = { dependencies: { '@tapestry/core': '^0.1.0', '@mallek/lf': '*' } };
    addLink(tmpDir, '@mallek/lf', '/somewhere'); // lf satisfied by link
    expect(checkMissingDeps(tmpDir, manifest)).toEqual(['@tapestry/core']);
  });

  it('checkMissingDeps treats an installed dir as satisfied', () => {
    fs.mkdirSync(path.join(tmpDir, 'packs', '@tapestry', 'core'), { recursive: true });
    const manifest = { dependencies: { '@tapestry/core': '^0.1.0' } };
    expect(checkMissingDeps(tmpDir, manifest)).toEqual([]);
  });
});

const { partitionDeps } = require('../../src/lib/links');

describe('partitionDeps', () => {
  it('returns empty needsInstall when manifest has no dependencies', () => {
    expect(partitionDeps(tmpDir, {})).toEqual({ needsInstall: {} });
    expect(partitionDeps(tmpDir, { dependencies: {} })).toEqual({ needsInstall: {} });
  });

  it('satisfies a linked dep without a version check', () => {
    addLink(tmpDir, '@tapestry/core', '/somewhere');
    const manifest = { dependencies: { '@tapestry/core': '^0.1.0' } };
    expect(partitionDeps(tmpDir, manifest)).toEqual({ needsInstall: {} });
  });

  it('satisfies an installed dep whose version matches the range', () => {
    fs.mkdirSync(path.join(tmpDir, 'packs', '@tapestry', 'core'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'packs', '@tapestry', 'core', 'pack.yaml'),
      'name: "@tapestry/core"\nversion: "0.2.1"\n'
    );
    const manifest = { dependencies: { '@tapestry/core': '^0.2.0' } };
    expect(partitionDeps(tmpDir, manifest)).toEqual({ needsInstall: {} });
  });

  it('marks an installed dep as needs-install when version is too old', () => {
    fs.mkdirSync(path.join(tmpDir, 'packs', '@tapestry', 'core'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'packs', '@tapestry', 'core', 'pack.yaml'),
      'name: "@tapestry/core"\nversion: "0.1.0"\n'
    );
    const manifest = { dependencies: { '@tapestry/core': '^0.2.0' } };
    expect(partitionDeps(tmpDir, manifest)).toEqual({ needsInstall: { '@tapestry/core': '^0.2.0' } });
  });

  it('marks a completely absent dep as needs-install', () => {
    const manifest = { dependencies: { '@tapestry/cooking': '^0.1.0' } };
    expect(partitionDeps(tmpDir, manifest)).toEqual({ needsInstall: { '@tapestry/cooking': '^0.1.0' } });
  });

  it('handles a mix of satisfied and unsatisfied deps', () => {
    addLink(tmpDir, '@tapestry/core', '/somewhere');
    fs.mkdirSync(path.join(tmpDir, 'packs', '@tapestry', 'survival'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'packs', '@tapestry', 'survival', 'pack.yaml'),
      'name: "@tapestry/survival"\nversion: "0.1.0"\n'
    );
    const manifest = {
      dependencies: {
        '@tapestry/core': '^0.1.0',      // linked — satisfied
        '@tapestry/survival': '^0.1.0',   // installed, version ok — satisfied
        '@tapestry/cooking': '^0.1.0',    // absent — needs install
      },
    };
    expect(partitionDeps(tmpDir, manifest)).toEqual({
      needsInstall: { '@tapestry/cooking': '^0.1.0' },
    });
  });
});
