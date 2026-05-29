'use strict';

const { requireAccess } = require('../lib/auth');
const { patchDistTag, listDistTags, DEFAULT_REGISTRY } = require('../lib/registry-client');

async function distTagSet(packName, tag, version, { registryUrl = DEFAULT_REGISTRY } = {}) {
  const token = await requireAccess();
  await patchDistTag(packName, tag, version, token, registryUrl);
  console.log(`  ${packName}  ${tag} -> ${version}`);
  console.log('Done.');
}

async function distTagList(packName, { registryUrl = DEFAULT_REGISTRY } = {}) {
  const tags = await listDistTags(packName, registryUrl);
  const entries = Object.entries(tags);
  if (entries.length === 0) {
    console.log(`No tags set for ${packName}`);
    return;
  }
  for (const [tag, version] of entries) {
    console.log(`  ${tag}: ${version}`);
  }
}

module.exports = { distTagSet, distTagList };
