'use strict';

const path = require('path');
const { readYaml, writeYaml } = require('../util/yaml');

const CONTENT_GLOBS = {
  area_definitions: 'areas/**/area.yaml',
  rooms: 'areas/**/rooms/*.yaml',
};

// Additively ensure the pack manifest declares the given content globs.
// Returns the list of keys that were added (empty if no change).
function ensureContentGlobs(packDir, globs = CONTENT_GLOBS) {
  const manifestPath = path.join(packDir, 'pack.yaml');
  const manifest = readYaml(manifestPath) || {};
  if (!manifest.content || typeof manifest.content !== 'object') {
    manifest.content = {};
  }
  const added = [];
  for (const [key, value] of Object.entries(globs)) {
    if (!(key in manifest.content)) {
      manifest.content[key] = value;
      added.push(key);
    }
  }
  if (added.length > 0) {
    writeYaml(manifestPath, manifest);
  }
  return added;
}

module.exports = { ensureContentGlobs, CONTENT_GLOBS };
