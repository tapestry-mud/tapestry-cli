'use strict';

jest.mock('../../src/lib/git', () => ({ isRepo: jest.fn(() => true), commitAll: jest.fn() }));
jest.mock('../../src/commands/sync-area', () => ({ syncArea: jest.fn(), exportArea: jest.fn() }));
jest.mock('../../src/lib/file-sink', () => ({ fileSink: jest.fn(() => Promise.resolve('/out/x.tgz')) }));
jest.mock('../../src/lib/registry-sink', () => ({ registrySink: jest.fn(() => Promise.resolve()) }));

const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeYaml } = require('../../src/util/yaml');
const { isRepo } = require('../../src/lib/git');
const { syncArea } = require('../../src/commands/sync-area');
const { fileSink } = require('../../src/lib/file-sink');
const { registrySink } = require('../../src/lib/registry-sink');
const { harvest } = require('../../src/commands/harvest');

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harvest-'));
  isRepo.mockReturnValue(true);
  syncArea.mockReset();
  fileSink.mockReset().mockResolvedValue('/out/x.tgz');
  registrySink.mockReset();
});
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function seedSideCar() {
  const dir = path.join(tmp, 'data', 'areas', 'lf-hollow', 'rooms');
  fs.mkdirSync(dir, { recursive: true });
  writeYaml(path.join(dir, 'a.yaml'), { id: 'legends-forgotten:a', area: 'lf-hollow', name: 'A' });
}
function seedLinkedPack() {
  const packDir = path.join(tmp, 'packs', '@legends', 'forgotten');
  fs.mkdirSync(packDir, { recursive: true });
  writeYaml(path.join(packDir, 'pack.yaml'), { name: '@legends/forgotten', version: '0.1.0' });
  writeYaml(path.join(tmp, 'tapestry-links.yaml'), { version: 1, links: { '@legends/forgotten': packDir } });
}

it('auto-detects the git sink when an owned linked pack is a git repo', async () => {
  seedSideCar();
  seedLinkedPack();
  isRepo.mockReturnValue(true);
  await harvest('legends-forgotten:lf-hollow', { cwd: tmp, gameRoot: tmp });
  expect(syncArea).toHaveBeenCalledTimes(1);
  expect(fileSink).not.toHaveBeenCalled();
});

it('auto-detects the file sink when no pack is linked (hobbyist)', async () => {
  seedSideCar();
  await harvest('legends-forgotten:lf-hollow', { cwd: tmp, gameRoot: tmp });
  expect(fileSink).toHaveBeenCalledTimes(1);
  expect(syncArea).not.toHaveBeenCalled();
});

it('honors an explicit --sink file even when a git pack is present', async () => {
  seedSideCar();
  seedLinkedPack();
  await harvest('legends-forgotten:lf-hollow', { cwd: tmp, gameRoot: tmp, sink: 'file' });
  expect(fileSink).toHaveBeenCalledTimes(1);
  expect(syncArea).not.toHaveBeenCalled();
});

it('throws on an unknown sink', async () => {
  seedSideCar();
  await expect(harvest('legends-forgotten:lf-hollow', { cwd: tmp, gameRoot: tmp, sink: 'ftp' }))
    .rejects.toThrow(/unknown sink/i);
});

it('routes to registrySink when --sink registry is explicit', async () => {
  seedSideCar();
  await harvest('legends-forgotten:lf-hollow', { cwd: tmp, gameRoot: tmp, sink: 'registry' });
  expect(registrySink).toHaveBeenCalledTimes(1);
  expect(syncArea).not.toHaveBeenCalled();
  expect(fileSink).not.toHaveBeenCalled();
});
