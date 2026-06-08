'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const tar = require('tar');
const { writeYaml, readYaml } = require('../../src/util/yaml');
const { fileSink } = require('../../src/lib/file-sink');

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'file-sink-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function seedSideCar(ns) {
  const dir = path.join(tmp, 'data', 'areas', 'lf-hollow', 'rooms');
  fs.mkdirSync(dir, { recursive: true });
  writeYaml(path.join(dir, 'lf-hollow-anchor.yaml'), {
    id: `${ns}:lf-hollow-anchor`, area: 'lf-hollow', name: 'Anchor', description: 'x',
  });
}

function seedLinkedPack() {
  const packDir = path.join(tmp, 'packs', '@legends', 'forgotten');
  fs.mkdirSync(packDir, { recursive: true });
  writeYaml(path.join(packDir, 'pack.yaml'), { name: '@legends/forgotten', version: '0.3.0', type: 'world' });
  writeYaml(path.join(tmp, 'tapestry-links.yaml'), { version: 1, links: { '@legends/forgotten': packDir } });
  return packDir;
}

// Read a file out of a .tgz into a string (entries are prefixed `package/`).
async function entryFromTgz(tgz, entryPath) {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'untar-'));
  await tar.extract({ file: tgz, cwd: dest });
  const p = path.join(dest, 'package', entryPath);
  const data = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  fs.rmSync(dest, { recursive: true, force: true });
  return data;
}

it('hobbyist: no pack -> synthesize manifest, tgz at 0.1.0, no bump', async () => {
  seedSideCar('legends-forgotten');
  const out = await fileSink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow', keepSidecars: true,
  });
  expect(fs.existsSync(out)).toBe(true);
  expect(path.basename(out)).toBe('forgotten-0.1.0.tgz');
  const manifest = await entryFromTgz(out, 'pack.yaml');
  expect(manifest).toMatch(/name: ['"]?@legends\/forgotten/);
  expect(manifest).toMatch(/version: ['"]?0\.1\.0/);
  const room = await entryFromTgz(out, 'areas/lf-hollow/rooms/lf-hollow-anchor.yaml');
  expect(room).toMatch(/lf-hollow-anchor/);
});

it('owned pack: copies the pack basis, folds the area, snapshots at the current version', async () => {
  seedSideCar('legends-forgotten');
  const packDir = seedLinkedPack();
  const out = await fileSink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow', keepSidecars: true,
  });
  expect(path.basename(out)).toBe('forgotten-0.3.0.tgz'); // snapshot, NO bump (avoids a phantom version)
  // The real linked pack is NOT mutated (file sink never claims source of truth).
  expect(readYaml(path.join(packDir, 'pack.yaml')).version).toBe('0.3.0');
});

it('moves side-cars by default after the tarball is written', async () => {
  seedSideCar('legends-forgotten');
  await fileSink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
  });
  expect(fs.existsSync(path.join(tmp, 'data', 'areas', 'lf-hollow'))).toBe(false);
});

it('honors --out and --keep-sidecars', async () => {
  seedSideCar('legends-forgotten');
  const outPath = path.join(tmp, 'backup.tgz');
  const out = await fileSink('legends-forgotten:lf-hollow', {
    cwd: tmp, gameRoot: tmp, namespace: 'legends-forgotten', area: 'lf-hollow',
    out: outPath, keepSidecars: true,
  });
  expect(out).toBe(outPath);
  expect(fs.existsSync(outPath)).toBe(true);
  expect(fs.existsSync(path.join(tmp, 'data', 'areas', 'lf-hollow'))).toBe(true);
});
