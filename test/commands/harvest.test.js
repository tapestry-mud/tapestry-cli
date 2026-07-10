'use strict';

jest.mock('../../src/lib/git', () => ({ isRepo: jest.fn(() => true), commitAll: jest.fn() }));
jest.mock('../../src/commands/sync-area', () => ({ syncArea: jest.fn(), exportArea: jest.fn() }));
jest.mock('../../src/lib/file-sink', () => ({ fileSink: jest.fn(() => Promise.resolve('/out/x.tgz')) }));
jest.mock('../../src/lib/registry-sink', () => ({ registrySink: jest.fn(() => Promise.resolve()) }));
jest.mock('../../src/lib/fork-core', () => ({
  buildForkPack: jest.fn(() => ({
    forkNamespace: 'mallek-core-fork', files: ['square.yaml'], version: '0.1.0',
  })),
}));
jest.mock('../../src/lib/tarball-builder', () => ({
  buildTarball: jest.fn(() => Promise.resolve()),
  computeIntegrity: jest.fn(() => 'sha256-abc'),
}));
jest.mock('node-fetch');
// Mock only readSession/requireAccess; keep the real decodeScopes (pack-resolve.js
// destructures both readSession and decodeScopes from this module - a mock missing
// decodeScopes would leave it undefined and throw inside resolveOperatorScope()).
jest.mock('../../src/lib/auth', () => ({
  ...jest.requireActual('../../src/lib/auth'),
  readSession: jest.fn(() => null),
  requireAccess: jest.fn(() => Promise.resolve('tok')),
}));
jest.mock('../../src/lib/registry-client', () => ({
  DEFAULT_REGISTRY: 'http://r.test',
  throwIfError: jest.fn(() => Promise.resolve()),
}));

const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeYaml } = require('../../src/util/yaml');
const { isRepo } = require('../../src/lib/git');
const { syncArea } = require('../../src/commands/sync-area');
const { fileSink } = require('../../src/lib/file-sink');
const { registrySink } = require('../../src/lib/registry-sink');
const { harvest } = require('../../src/commands/harvest');
const { buildForkPack } = require('../../src/lib/fork-core');
const { buildTarball } = require('../../src/lib/tarball-builder');
const fetch = require('node-fetch');
const { readSession, requireAccess } = require('../../src/lib/auth');

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harvest-'));
  isRepo.mockReturnValue(true);
  syncArea.mockReset();
  fileSink.mockReset().mockResolvedValue('/out/x.tgz');
  registrySink.mockReset();
  buildForkPack.mockReset().mockReturnValue({
    forkNamespace: 'mallek-core-fork', files: ['square.yaml'], version: '0.1.0',
  });
  buildTarball.mockReset().mockResolvedValue(undefined);
  if (fetch.mockReset) { fetch.mockReset(); }
  if (requireAccess.mockReset) { requireAccess.mockReset().mockResolvedValue('tok'); }
  readSession.mockReset().mockReturnValue(null);
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

// Fakes a logged-in auth session whose access-token `scopes` claim is [scope] - the same
// shape the registry issues (tapestry-registry authRoutes.js issueSession: scopes:
// [account.handle]). No file I/O: resolveOperatorScope() reads this via the mocked
// auth.readSession(), never tapestry-links.yaml.
function fakeJwt(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}
function mockOperatorScope(scope = 'mallek') {
  readSession.mockReturnValue({ access: fakeJwt({ sub: scope, scopes: [scope] }) });
}

// Seeds a linked origin pack (e.g. @tapestry/core) with a known version.
// Adds it to tapestry-links.yaml so resolvePackDirOrNull can find it.
function seedOriginPack(ns = 'tapestry-core', version = '1.2.3') {
  const packDir = path.join(tmp, 'origin-packs', ns);
  fs.mkdirSync(packDir, { recursive: true });
  writeYaml(path.join(packDir, 'pack.yaml'), { name: '@tapestry/core', version });
  const linksPath = path.join(tmp, 'tapestry-links.yaml');
  const existing = fs.existsSync(linksPath)
    ? (require('../../src/util/yaml').readYaml(linksPath) || {})
    : {};
  const links = existing.links || {};
  links['@tapestry/core'] = packDir;
  writeYaml(linksPath, { ...existing, links });
  return packDir;
}

// Seeds a linked fork pack (e.g. @mallek/core-fork) - used to test the source-of-truth gate.
function seedForkLinkedPack(packName = '@mallek/core-fork', ns = 'mallek-core-fork') {
  const packDir = path.join(tmp, 'fork-packs', ns);
  fs.mkdirSync(packDir, { recursive: true });
  writeYaml(path.join(packDir, 'pack.yaml'), { name: packName, version: '0.1.0' });
  const linksPath = path.join(tmp, 'tapestry-links.yaml');
  const existing = fs.existsSync(linksPath)
    ? (require('../../src/util/yaml').readYaml(linksPath) || {})
    : {};
  const links = existing.links || {};
  links[packName] = packDir;
  writeYaml(linksPath, { ...existing, links });
  return packDir;
}

// Seeds a tapestry-core:village-green side-car in the test gameRoot.
function seedForkSideCar() {
  const dir = path.join(tmp, 'data', 'areas', 'village-green', 'rooms');
  fs.mkdirSync(dir, { recursive: true });
  writeYaml(path.join(dir, 'square.yaml'), {
    id: 'tapestry-core:square', area: 'village-green', name: 'The Square', description: 'x',
  });
}

// ---- Fork path tests ----

it('routes to forkHarvest when area namespace scope is foreign (SA1 scope-based detection)', async () => {
  seedForkSideCar();
  seedOriginPack();
  mockOperatorScope('mallek'); // isOwnedNamespace('tapestry-core', 'mallek') -> false -> fork
  await harvest('tapestry-core:village-green', {
    cwd: tmp, gameRoot: tmp,
    name: '@mallek/core-fork',
    keepSidecars: true,
  });
  expect(buildForkPack).toHaveBeenCalledTimes(1);
  expect(buildForkPack).toHaveBeenCalledWith(
    expect.stringContaining('tapestry-fork'),
    expect.objectContaining({
      originNamespace: 'tapestry-core',
      originVersion: '1.2.3',
      originPackName: '@tapestry/core',
      forkPackName: '@mallek/core-fork',
    })
  );
  expect(syncArea).not.toHaveBeenCalled();
  expect(fileSink).not.toHaveBeenCalled();
});

it('errors with section-3 message when area is foreign and --name is absent (F1)', async () => {
  seedForkSideCar();
  seedOriginPack();
  mockOperatorScope('mallek'); // isOwnedNamespace('tapestry-core', 'mallek') -> false -> fork, but no --name
  // Anchored: no embedded 'error:' prefix (bin/tapestry.js adds it), and the convention
  // example composes scope + origin PACKAGE ('core'), not the full namespace.
  await expect(harvest('tapestry-core:village-green', {
    cwd: tmp, gameRoot: tmp, keepSidecars: true,
  })).rejects.toThrow(
    /^area 'tapestry-core:village-green' is a fork target[\s\S]*Convention: @mallek\/core-fork /
  );
  expect(buildForkPack).not.toHaveBeenCalled();
});

it('errors when --name is not a scoped @scope/fork-name (form validation)', async () => {
  seedForkSideCar();
  seedOriginPack();
  mockOperatorScope('mallek');
  await expect(harvest('tapestry-core:village-green', {
    cwd: tmp, gameRoot: tmp, name: 'corefork', keepSidecars: true,
  })).rejects.toThrow(/must match @scope\/fork-name/);
  expect(buildForkPack).not.toHaveBeenCalled();
});

it('does NOT fork when area namespace scope matches operator scope, even with renaming --name (F9)', async () => {
  seedSideCar(); // legends-forgotten namespace
  seedLinkedPack(); // links @legends/forgotten
  mockOperatorScope('legends'); // isOwnedNamespace('legends-forgotten', 'legends') -> true -> owned
  await harvest('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, name: '@legends/forgotten-v2',
  });
  expect(buildForkPack).not.toHaveBeenCalled();
  // Routes to git sink (linked + isRepo=true from beforeEach)
  expect(syncArea).toHaveBeenCalledTimes(1);
});

it('does not fork when no operator scope is known, even for an unowned foreign namespace (R2-F1/R2-F2/SA4)', async () => {
  seedForkSideCar();
  // No origin pack linked (true exemplar B): readSession defaults to null in beforeEach ->
  // resolveOperatorScope() -> null -> never a fork. No linked pack for this namespace ->
  // packDir null -> shipped file-sink dispatch (exemplar B), not the section-3 fork error.
  const result = await harvest('tapestry-core:village-green', {
    cwd: tmp, gameRoot: tmp, keepSidecars: true,
  });
  expect(buildForkPack).not.toHaveBeenCalled();
  expect(fileSink).toHaveBeenCalledTimes(1);
  expect(result).toBe('/out/x.tgz');
});

it('routes to the shipped git dispatch, not the file sink, when no operator scope is known but the foreign origin is linked (R3-F1 companion, SA4 documented residual)', async () => {
  seedForkSideCar();
  seedOriginPack();
  // readSession defaults to null -> resolveOperatorScope() -> null -> never a fork. But
  // @tapestry/core IS linked here, so resolvePackDirOrNull finds it and isRepo (mocked true
  // in beforeEach) routes to the shipped git dispatch, not the file sink. This is "preserved
  // exactly as it shipped" (SA4) - the file-sink sentence in SA4 describes the no-linked-pack
  // case; a linked pack still gets the shipped auto-detect dispatch unchanged.
  await harvest('tapestry-core:village-green', {
    cwd: tmp, gameRoot: tmp, keepSidecars: true,
  });
  expect(buildForkPack).not.toHaveBeenCalled();
  expect(syncArea).toHaveBeenCalledTimes(1);
  expect(fileSink).not.toHaveBeenCalled();
});

it('errors when origin is not linked (cannot read version)', async () => {
  seedForkSideCar();
  mockOperatorScope('mallek');
  // No origin pack seeded -> resolvePackDirOrNull returns null for tapestry-core
  await expect(harvest('tapestry-core:village-green', {
    cwd: tmp, gameRoot: tmp, name: '@mallek/core-fork', keepSidecars: true,
  })).rejects.toThrow(/tapestry link @tapestry\/core <path>/);
  expect(buildForkPack).not.toHaveBeenCalled();
});

it('forkHarvest: file sink (default) tars the fork dir and logs', async () => {
  seedForkSideCar();
  seedOriginPack();
  mockOperatorScope('mallek');
  const result = await harvest('tapestry-core:village-green', {
    cwd: tmp, gameRoot: tmp,
    name: '@mallek/core-fork', keepSidecars: true,
  });
  expect(buildTarball).toHaveBeenCalledTimes(1);
  expect(result).toMatch(/core-fork-0\.1\.0\.tgz$/);
});

it('forkHarvest: --sink registry POSTs to the registry', async () => {
  seedForkSideCar();
  seedOriginPack();
  mockOperatorScope('mallek');
  fetch.mockResolvedValue({
    ok: true, status: 201,
    json: async () => ({ name: '@mallek/core-fork', version: '0.1.0' }),
  });
  await harvest('tapestry-core:village-green', {
    cwd: tmp, gameRoot: tmp,
    name: '@mallek/core-fork', sink: 'registry', keepSidecars: true,
  });
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/v1/publish'),
    expect.objectContaining({ method: 'POST' })
  );
});

it('forkHarvest: --sink registry refuses when fork pack is a linked git repo (F4)', async () => {
  seedForkSideCar();
  seedOriginPack();
  mockOperatorScope('mallek');
  seedForkLinkedPack(); // fork pack is linked -> isRepo() returns true (mock is always true)
  await expect(harvest('tapestry-core:village-green', {
    cwd: tmp, gameRoot: tmp,
    name: '@mallek/core-fork', sink: 'registry', keepSidecars: true,
  })).rejects.toThrow(/linked git repo/i);
  expect(fetch).not.toHaveBeenCalled();
});

it('forkHarvest: --sink git errors when fork pack is not a linked git repo', async () => {
  seedForkSideCar();
  seedOriginPack();
  mockOperatorScope('mallek');
  // No fork pack linked -> resolvePackDirOrNull returns null for forkNamespace
  await expect(harvest('tapestry-core:village-green', {
    cwd: tmp, gameRoot: tmp,
    name: '@mallek/core-fork', sink: 'git', keepSidecars: true,
  })).rejects.toThrow(/git sink for a fork requires the fork pack to be a linked git repo/);
});
