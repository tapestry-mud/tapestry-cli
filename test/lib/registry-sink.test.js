'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('node-fetch');
jest.mock('../../src/lib/auth');
jest.mock('../../src/lib/tarball-builder');
jest.mock('../../src/lib/git', () => ({ isRepo: jest.fn(() => false) }));

const fetch = require('node-fetch');
const { requireAccess } = require('../../src/lib/auth');
const { buildTarball, computeIntegrity } = require('../../src/lib/tarball-builder');
const { isRepo } = require('../../src/lib/git');
const { writeYaml, readYaml } = require('../../src/util/yaml');
const { registrySink } = require('../../src/lib/registry-sink');

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-sink-'));
  jest.clearAllMocks();
  isRepo.mockReturnValue(false);
  requireAccess.mockResolvedValue('test-token');
  computeIntegrity.mockReturnValue('sha256-abc');
  buildTarball.mockImplementation(async (_packDir, outputPath) => {
    fs.writeFileSync(outputPath, 'dummy');
  });
  fetch.mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ name: '@legends/forgotten', version: '0.1.1' }),
  });
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

function seedSideCar(ns = 'legends-forgotten') {
  const dir = path.join(tmp, 'data', 'areas', 'lf-hollow', 'rooms');
  fs.mkdirSync(dir, { recursive: true });
  writeYaml(path.join(dir, 'anchor.yaml'), {
    id: `${ns}:anchor`, area: 'lf-hollow', name: 'Anchor', description: 'x',
  });
}

function seedLinkedPack(version = '0.1.0') {
  const packDir = path.join(tmp, 'packs', '@legends', 'forgotten');
  fs.mkdirSync(packDir, { recursive: true });
  writeYaml(path.join(packDir, 'pack.yaml'), {
    name: '@legends/forgotten', version, type: 'world',
    validation: 'strict', engine: '>=0.1.0',
  });
  writeYaml(path.join(tmp, 'tapestry-links.yaml'), {
    version: 1, links: { '@legends/forgotten': packDir },
  });
  return packDir;
}

it('refuses registry-direct when the linked pack is a git repo', async () => {
  seedSideCar();
  seedLinkedPack();
  isRepo.mockReturnValue(true);
  await expect(registrySink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
  })).rejects.toThrow(/git repo/);
  expect(fetch).not.toHaveBeenCalled();
});

it('renders area into the real pack dir and POSTs (content accumulates across harvests)', async () => {
  seedSideCar();
  const packDir = seedLinkedPack('0.1.0');
  await registrySink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
    keepSidecars: true,
  });
  // Content landed in the REAL pack dir - not discarded with a temp copy.
  expect(fs.existsSync(path.join(packDir, 'areas', 'lf-hollow', 'rooms', 'anchor.yaml'))).toBe(true);
  // Version bumped in the real pack.
  expect(readYaml(path.join(packDir, 'pack.yaml')).version).toBe('0.1.1');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/v1/publish'),
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    })
  );
});

it('synthesizes manifest at 0.1.0 for the hobbyist (no linked pack)', async () => {
  seedSideCar('legends-forgotten');
  fetch.mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ name: '@legends/forgotten', version: '0.1.0' }),
  });
  await registrySink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
    keepSidecars: true,
  });
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/v1/publish'),
    expect.objectContaining({ method: 'POST' })
  );
});

it('removes side-cars after a successful publish by default', async () => {
  seedSideCar();
  seedLinkedPack();
  await registrySink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
  });
  expect(fs.existsSync(path.join(tmp, 'data', 'areas', 'lf-hollow'))).toBe(false);
});

it('preserves side-cars when --keep-sidecars is set', async () => {
  seedSideCar();
  seedLinkedPack();
  await registrySink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
    keepSidecars: true,
  });
  expect(fs.existsSync(path.join(tmp, 'data', 'areas', 'lf-hollow', 'rooms'))).toBe(true);
});

it('propagates registry errors and preserves side-cars', async () => {
  seedSideCar();
  seedLinkedPack();
  fetch.mockResolvedValue({
    ok: false, status: 409,
    json: async () => ({ error: 'version 0.1.1 already exists' }),
  });
  await expect(registrySink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
  })).rejects.toThrow(/version 0\.1\.1 already exists/);
  expect(fs.existsSync(path.join(tmp, 'data', 'areas', 'lf-hollow', 'rooms'))).toBe(true);
});

it('propagates auth errors', async () => {
  seedSideCar();
  seedLinkedPack();
  requireAccess.mockRejectedValue(new Error('Not logged in. Run: tapestry login'));
  await expect(registrySink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
  })).rejects.toThrow('Not logged in');
});

it('uses --minor bump level when specified', async () => {
  seedSideCar();
  const packDir = seedLinkedPack('0.1.0');
  await registrySink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
    keepSidecars: true, bump: 'minor',
  });
  expect(readYaml(path.join(packDir, 'pack.yaml')).version).toBe('0.2.0');
});

it('uses a custom registryUrl when provided', async () => {
  seedSideCar();
  seedLinkedPack();
  await registrySink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
    keepSidecars: true, registryUrl: 'http://localhost:3002',
  });
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:3002/v1/publish',
    expect.anything()
  );
});

it('fails loudly when the owned pack dir is not writable', async () => {
  seedSideCar();
  const packDir = seedLinkedPack();
  const spy = jest.spyOn(fs, 'accessSync').mockImplementation((p, _mode) => {
    if (p === packDir) {
      throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    }
  });
  try {
    await expect(registrySink('legends-forgotten:lf-hollow', {
      cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
    })).rejects.toThrow(/Cannot write to pack directory/);
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});

it('cleans up the hobbyist temp dir even when renderArea throws', async () => {
  // No linked pack, no side-car - hobbyist path. renderArea throws "No authored rooms found..."
  // because the side-car directory does not exist. The finally block must clean up tmpBuild.
  const before = fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('tapestry-harvest-'));
  await expect(registrySink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
  })).rejects.toThrow(/No authored rooms found/);
  const after = fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('tapestry-harvest-'));
  expect(after.length).toBe(before.length);
});
