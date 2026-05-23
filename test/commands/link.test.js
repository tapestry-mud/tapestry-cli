'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { link, unlink, linkList } = require('../../src/commands/link');
const { readLinks } = require('../../src/lib/links');
const { readBoot } = require('../../src/lib/boot');
const { writeYaml } = require('../../src/util/yaml');

let tmpDir, packDir;

function makeProject() {
  writeYaml(path.join(tmpDir, 'tapestry.yaml'), { name: 'test', engine: { version: '0.4.0', mode: 'docker' }, dependencies: {} });
  fs.mkdirSync(path.join(tmpDir, 'packs'), { recursive: true });
}
function makePack(deps = {}) {
  packDir = path.join(tmpDir, 'lf-src');
  fs.mkdirSync(packDir, { recursive: true });
  writeYaml(path.join(packDir, 'pack.yaml'), { name: '@mallek/legends-forgotten', version: '0.1.3', dependencies: deps });
}

beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tapestry-link-')); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true }); });

describe('link', () => {
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

  it('warns about a missing dependency', async () => {
    makeProject(); makePack({ '@tapestry/core': '^0.1.0' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await link(packDir, { cwd: tmpDir });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('@tapestry/core'));
    warn.mockRestore();
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
