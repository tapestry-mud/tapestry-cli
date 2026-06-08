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

// Reverse of PackNamespace: split the namespace on its FIRST hyphen -> @scope/package.
function namespaceToName(namespace) {
  const dash = namespace.indexOf('-');
  if (dash < 1 || dash === namespace.length - 1) {
    throw new Error(
      `Cannot derive a pack name from namespace '${namespace}'. Pass --name <@scope/pack>.`);
  }
  const scope = namespace.slice(0, dash);
  const pkg = namespace.slice(dash + 1);
  return `@${scope}/${pkg}`;
}

function titleCase(s) {
  return s.split(/[-_]/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Synthesize a strict-bootable world manifest for the no-pack hobbyist (exemplar B).
// Content globs are added by renderArea's ensureContentGlobs after content lands.
function synthesizeManifest(namespace, { name } = {}) {
  const packName = name || namespaceToName(namespace);
  const scope = packName.replace(/^@/, '').split('/')[0];
  const pkgPart = packName.split('/')[1] || namespace;
  return {
    name: packName,
    version: '0.1.0',
    type: 'world',
    display_name: titleCase(pkgPart),
    description: `Harvested world pack for ${namespace}.`,
    author: scope,
    license: 'MIT',
    engine: '>=0.1.0',
    validation: 'strict',
  };
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

module.exports = { ensureContentGlobs, bumpVersion, namespaceToName, synthesizeManifest, CONTENT_GLOBS };
