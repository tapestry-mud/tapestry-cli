'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../src/lib/semver-resolver');
jest.mock('../../src/commands/install', () => ({
  installResolved: jest.fn(),
  // eslint-disable-next-line global-require
  packInstallPath: jest.fn((cwd, name) => require('path').join(cwd, 'packs', ...name.split('/'))),
}));
jest.mock('../../src/lib/auth');

const { resolve } = require('../../src/lib/semver-resolver');
const { installResolved, packInstallPath } = require('../../src/commands/install');
const { loadToken } = require('../../src/lib/auth');

const { link, unlink, linkList } = require('../../src/commands/link');
const { readLinks } = require('../../src/lib/links');
const { readBoot } = require('../../src/lib/boot');
const { readLock } = require('../../src/lib/lock-file');
const { writeYaml } = require('../../src/util/yaml');

let tmpDir, packDir;

function makeProject() {
  writeYaml(path.join(tmpDir, 'tapestry.yaml'), {
    name: 'test', engine: { version: '0.4.0', mode: 'docker' }, dependencies: {},
  });
  fs.mkdirSync(path.join(tmpDir, 'packs'), { recursive: true });
}

function makePack(deps = {}) {
  packDir = path.join(tmpDir, 'lf-src');
  fs.mkdirSync(packDir, { recursive: true });
  writeYaml(path.join(packDir, 'pack.yaml'), {
    name: '@mallek/legends-forgotten', version: '0.1.3', dependencies: deps,
  });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tapestry-link-'));
  resolve.mockReset();
  installResolved.mockReset();
  loadToken.mockReturnValue(null);
  installResolved.mockResolvedValue(undefined);
  resolve.mockResolvedValue({});
});
afterEach(() => { fs.rmSync(tmpDir, { recursive: true }); });

describe('link (no deps)', () => {
  it('throws when tapestry.yaml is missing', async () => {
    makePack();
    await expect(link(packDir, { cwd: tmpDir })).rejects.toThrow('No tapestry.yaml found');
  });

  it('records the link and adds a boot entry', async () => {
    makeProject(); makePack();
    await link(packDir, { cwd: tmpDir });
    expect(readLinks(tmpDir).links['@mallek/legends-forgotten']).toBe(path.resolve(packDir));
    expect(readBoot(tmpDir).packs['@mallek/legends-forgotten']).toEqual({ enabled: true });
  });

  it('throws when the path is not a pack', async () => {
    makeProject();
    const empty = path.join(tmpDir, 'empty');
    fs.mkdirSync(empty);
    await expect(link(empty, { cwd: tmpDir })).rejects.toThrow('not a pack');
  });

  it('does not call resolve or installResolved when pack has no deps', async () => {
    makeProject(); makePack();
    await link(packDir, { cwd: tmpDir });
    expect(resolve).not.toHaveBeenCalled();
    expect(installResolved).not.toHaveBeenCalled();
  });

  it('warns about active: false on the auto-install path (no deps)', async () => {
    makeProject();
    packDir = path.join(tmpDir, 'inactive-src');
    fs.mkdirSync(packDir, { recursive: true });
    writeYaml(path.join(packDir, 'pack.yaml'), {
      name: '@mallek/inactive-pack', version: '0.1.0', active: false, dependencies: {},
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await link(packDir, { cwd: tmpDir });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('active: false'));
    warn.mockRestore();
  });
});

describe('link (auto-install deps)', () => {
  it('calls resolve with the missing dep range', async () => {
    makeProject(); makePack({ '@tapestry/cooking': '^0.1.0' });
    resolve.mockResolvedValue({
      '@tapestry/cooking': { version: '0.1.0', integrity: 'sha256-x', tarball: 'http://r/c.tgz' },
    });
    await link(packDir, { cwd: tmpDir });
    expect(resolve).toHaveBeenCalledWith(
      { '@tapestry/cooking': '^0.1.0' },
      expect.any(String),
      null
    );
  });

  it('calls installResolved with the resolved map', async () => {
    makeProject(); makePack({ '@tapestry/cooking': '^0.1.0' });
    const resolved = {
      '@tapestry/cooking': { version: '0.1.0', integrity: 'sha256-x', tarball: 'http://r/c.tgz' },
    };
    resolve.mockResolvedValue(resolved);
    await link(packDir, { cwd: tmpDir });
    expect(installResolved).toHaveBeenCalledWith(tmpDir, resolved, null);
  });

  it('merges resolved packages into the lock file', async () => {
    makeProject(); makePack({ '@tapestry/cooking': '^0.1.0' });
    resolve.mockResolvedValue({
      '@tapestry/cooking': { version: '0.1.0', integrity: 'sha256-x', tarball: 'http://r/c.tgz' },
    });
    await link(packDir, { cwd: tmpDir });
    const lock = readLock(tmpDir);
    expect(lock.resolved['@tapestry/cooking'].version).toBe('0.1.0');
  });

  it('prints the installed dep in the output', async () => {
    makeProject(); makePack({ '@tapestry/cooking': '^0.1.0' });
    resolve.mockResolvedValue({
      '@tapestry/cooking': { version: '0.1.0', integrity: 'sha256-x', tarball: 'http://r/c.tgz' },
    });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await link(packDir, { cwd: tmpDir });
    const out = logSpy.mock.calls.flat().join('\n');
    expect(out).toContain('linked @mallek/legends-forgotten');
    expect(out).toContain('installed @tapestry/cooking@0.1.0');
    logSpy.mockRestore();
  });

  it('skips a dep already satisfied by a linked pack (no version check)', async () => {
    makeProject(); makePack({ '@tapestry/core': '^0.1.0' });
    const { addLink } = require('../../src/lib/links');
    addLink(tmpDir, '@tapestry/core', '/some/path');
    await link(packDir, { cwd: tmpDir });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('skips a dep already installed with a satisfying version', async () => {
    makeProject(); makePack({ '@tapestry/core': '^0.1.0' });
    fs.mkdirSync(path.join(tmpDir, 'packs', '@tapestry', 'core'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'packs', '@tapestry', 'core', 'pack.yaml'),
      'name: "@tapestry/core"\nversion: "0.1.2"\n'
    );
    await link(packDir, { cwd: tmpDir });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('re-resolves a dep installed with an outdated version', async () => {
    makeProject(); makePack({ '@tapestry/core': '^0.2.0' });
    fs.mkdirSync(path.join(tmpDir, 'packs', '@tapestry', 'core'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'packs', '@tapestry', 'core', 'pack.yaml'),
      'name: "@tapestry/core"\nversion: "0.1.0"\n'
    );
    resolve.mockResolvedValue({
      '@tapestry/core': { version: '0.2.1', integrity: 'sha256-y', tarball: 'http://r/core.tgz' },
    });
    await link(packDir, { cwd: tmpDir });
    expect(resolve).toHaveBeenCalledWith({ '@tapestry/core': '^0.2.0' }, expect.any(String), null);
  });
});

describe('link --no-install', () => {
  it('warns about a missing dependency instead of installing it', async () => {
    makeProject(); makePack({ '@tapestry/core': '^0.1.0' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await link(packDir, { cwd: tmpDir, noInstall: true });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('@tapestry/core'));
    warn.mockRestore();
  });

  it('does not call resolve or installResolved', async () => {
    makeProject(); makePack({ '@tapestry/core': '^0.1.0' });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await link(packDir, { cwd: tmpDir, noInstall: true });
    expect(resolve).not.toHaveBeenCalled();
    expect(installResolved).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('still records the link when --no-install is used', async () => {
    makeProject(); makePack({ '@tapestry/core': '^0.1.0' });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await link(packDir, { cwd: tmpDir, noInstall: true });
    expect(readLinks(tmpDir).links['@mallek/legends-forgotten']).toBe(path.resolve(packDir));
    jest.restoreAllMocks();
  });
});

describe('link rollback on failure', () => {
  it('removes link and boot entry when resolve throws', async () => {
    makeProject(); makePack({ '@tapestry/cooking': '^0.1.0' });
    resolve.mockRejectedValue(new Error('registry unreachable'));
    await expect(link(packDir, { cwd: tmpDir })).rejects.toThrow('Cannot resolve dependencies');
    expect(readLinks(tmpDir).links['@mallek/legends-forgotten']).toBeUndefined();
    expect(readBoot(tmpDir).packs['@mallek/legends-forgotten']).toBeUndefined();
  });

  it('removes link and boot entry when installResolved throws', async () => {
    makeProject(); makePack({ '@tapestry/cooking': '^0.1.0' });
    resolve.mockResolvedValue({
      '@tapestry/cooking': { version: '0.1.0', integrity: 'sha256-x', tarball: 'http://r/c.tgz' },
    });
    installResolved.mockRejectedValue(new Error('network error mid-download'));
    await expect(link(packDir, { cwd: tmpDir })).rejects.toThrow('Cannot resolve dependencies');
    expect(readLinks(tmpDir).links['@mallek/legends-forgotten']).toBeUndefined();
    expect(readBoot(tmpDir).packs['@mallek/legends-forgotten']).toBeUndefined();
  });

  it('removes a partially installed dep directory on installResolved failure', async () => {
    makeProject(); makePack({ '@tapestry/cooking': '^0.1.0' });
    resolve.mockResolvedValue({
      '@tapestry/cooking': { version: '0.1.0', integrity: 'sha256-x', tarball: 'http://r/c.tgz' },
    });
    const cookingPath = path.join(tmpDir, 'packs', '@tapestry', 'cooking');
    installResolved.mockImplementation(async () => {
      fs.mkdirSync(cookingPath, { recursive: true });
      throw new Error('network error mid-download');
    });
    await expect(link(packDir, { cwd: tmpDir })).rejects.toThrow('Cannot resolve dependencies');
    expect(fs.existsSync(cookingPath)).toBe(false);
  });

  it('error message suggests --no-install', async () => {
    makeProject(); makePack({ '@tapestry/cooking': '^0.1.0' });
    resolve.mockRejectedValue(new Error('registry unreachable'));
    await expect(link(packDir, { cwd: tmpDir })).rejects.toThrow('--no-install');
  });
});

describe('unlink', () => {
  it('removes the link and boot entry', async () => {
    makeProject(); makePack();
    await link(packDir, { cwd: tmpDir });
    await unlink('@mallek/legends-forgotten', { cwd: tmpDir });
    expect(readLinks(tmpDir).links).toEqual({});
    expect(readBoot(tmpDir).packs['@mallek/legends-forgotten']).toBeUndefined();
  });

  it('throws when the name is not linked', async () => {
    makeProject();
    await expect(unlink('@x/y', { cwd: tmpDir })).rejects.toThrow('is not linked');
  });
});

describe('linkList', () => {
  it('prints a message when there are no links', async () => {
    makeProject();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await linkList({ cwd: tmpDir });
    expect(logSpy).toHaveBeenCalledWith('No linked packs.');
    logSpy.mockRestore();
  });

  it('lists active links', async () => {
    makeProject(); makePack();
    await link(packDir, { cwd: tmpDir });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await linkList({ cwd: tmpDir });
    expect(logSpy.mock.calls.flat().join('\n')).toContain('@mallek/legends-forgotten');
    logSpy.mockRestore();
  });
});
