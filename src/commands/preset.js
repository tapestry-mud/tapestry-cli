'use strict';

const { requireToken } = require('../lib/auth');
const { patchPreset, deletePreset, DEFAULT_REGISTRY } = require('../lib/registry-client');

async function presetSet(name, version, engineChannel, packs, { registryUrl = DEFAULT_REGISTRY } = {}) {
  const token = requireToken();
  await patchPreset(name, { version, engine_channel: engineChannel, packs }, token, registryUrl);
  console.log(`  Updated preset '${name}' to v${version}`);
  console.log('Done.');
}

async function presetDelete(name, { registryUrl = DEFAULT_REGISTRY } = {}) {
  const token = requireToken();
  await deletePreset(name, token, registryUrl);
  console.log(`  Deleted preset '${name}'`);
  console.log('Done.');
}

module.exports = { presetSet, presetDelete };
