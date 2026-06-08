'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeYaml } = require('../../src/util/yaml');
const { computeAreaStates, STATES } = require('../../src/lib/world-state');

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'world-state-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function sideCarRoom(area, ns, body) {
  const dir = path.join(tmp, 'data', 'areas', area, 'rooms');
  fs.mkdirSync(dir, { recursive: true });
  writeYaml(path.join(dir, `${area}-1.yaml`), Object.assign({ id: `${ns}:${area}-1`, area, name: 'R' }, body || {}));
}
function sideCarAreaYaml(area, envelope) {
  const dir = path.join(tmp, 'data', 'areas', area);
  fs.mkdirSync(dir, { recursive: true });
  writeYaml(path.join(dir, 'area.yaml'), envelope);
}
function linkedPack(ns, scope, pkg) {
  const packDir = path.join(tmp, 'packs', `@${scope}`, pkg);
  fs.mkdirSync(packDir, { recursive: true });
  writeYaml(path.join(packDir, 'pack.yaml'), { name: `@${scope}/${pkg}`, version: '0.1.0' });
  const links = path.join(tmp, 'tapestry-links.yaml');
  const data = fs.existsSync(links) ? require('../../src/util/yaml').readYaml(links) : { version: 1, links: {} };
  data.links[`@${scope}/${pkg}`] = packDir;
  writeYaml(links, data);
  return packDir;
}

it('Edited: owned side-car not yet in the pack', () => {
  sideCarRoom('lf-hollow', 'legends-forgotten');
  linkedPack('legends-forgotten', 'legends', 'forgotten');
  const rows = computeAreaStates(tmp, tmp);
  expect(rows).toHaveLength(1);
  expect(rows[0].state).toBe(STATES.EDITED);
  expect(rows[0].namespace).toBe('legends-forgotten');
});

it('Clean: side-car byte-matches the pack room', () => {
  sideCarRoom('lf-hollow', 'legends-forgotten');
  const packDir = linkedPack('legends-forgotten', 'legends', 'forgotten');
  const dest = path.join(packDir, 'areas', 'lf-hollow', 'rooms', 'lf-hollow-1.yaml');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  writeYaml(dest, { id: 'legends-forgotten:lf-hollow-1', area: 'lf-hollow', name: 'R' });
  expect(computeAreaStates(tmp, tmp)[0].state).toBe(STATES.CLEAN);
});

it('Fork: namespace maps to no linked pack you own', () => {
  sideCarRoom('village-green', 'tapestry-core');
  const rows = computeAreaStates(tmp, tmp);
  expect(rows[0].state).toBe(STATES.FORK);
});

it('WIP: area.yaml flags contains wip (overrides other states)', () => {
  sideCarRoom('lf-hollow', 'legends-forgotten');
  linkedPack('legends-forgotten', 'legends', 'forgotten');
  sideCarAreaYaml('lf-hollow', { area: { id: 'lf-hollow', name: 'H', flags: ['wip'] } });
  const rows = computeAreaStates(tmp, tmp);
  expect(rows[0].state).toBe(STATES.WIP);
  expect(rows[0].wip).toBe(true);
});
