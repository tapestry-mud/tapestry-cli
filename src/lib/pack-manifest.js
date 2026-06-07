'use strict';

const path = require('path');
const semver = require('semver');
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

// Bump the pack version (patch|minor|major). Returns { old, new }.
function bumpVersion(packDir, level = 'patch') {
  const manifestPath = path.join(packDir, 'pack.yaml');
  const manifest = readYaml(manifestPath) || {};
  const old = manifest.version;
  if (!old || !semver.valid(old)) {
    throw new Error(`pack.yaml has no valid semver version (found: ${old}). Cannot bump.`);
  }
  const next = semver.inc(old, level);
  if (!next) {
    throw new Error(`Invalid bump level '${level}'. Expected patch, minor, or major.`);
  }
  manifest.version = next;
  writeYaml(manifestPath, manifest);
  return { old, new: next };
}

module.exports = { ensureContentGlobs, bumpVersion, CONTENT_GLOBS };
