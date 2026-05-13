'use strict';

const { requireToken } = require('../lib/auth');
const { patchPreset, DEFAULT_REGISTRY } = require('../lib/registry-client');

async function presetSet(name, version, engineChannel, packs, { registryUrl = DEFAULT_REGISTRY } = {}) {
  const token = requireToken();
  await patchPreset(name, { version, engine_channel: engineChannel, packs }, token, registryUrl);
  console.log(`  Updated preset '${name}' to v${version}`);
  console.log('Done.');
}

module.exports = { presetSet };
