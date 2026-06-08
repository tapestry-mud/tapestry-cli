'use strict';

const path = require('path');
const { readYaml } = require('../util/yaml');
const { readLinks } = require('./links');

// "namespace:area-id" -> { namespace, area }. Throws on a malformed ref.
function parseAreaRef(areaRef) {
  const colon = (areaRef || '').indexOf(':');
  if (colon < 1) {
    throw new Error('Usage: <namespace:area-id> (e.g. legends-forgotten:village-green)');
  }
  return { namespace: areaRef.slice(0, colon), area: areaRef.slice(colon + 1) };
}

// "@legends/forgotten" -> "legends-forgotten" (mirrors engine PackLoader.PackNamespace).
function packNamespace(name) {
  if (name.indexOf('/') === -1) {
    return name;
  }
  return name.replace(/^@/, '').split('/').join('-');
}

// All linked pack dirs whose manifest namespace matches `namespace`.
function findPackMatches(cwd, namespace) {
  const { links } = readLinks(cwd);
  const matches = [];
  for (const [name, dir] of Object.entries(links)) {
    let derivedNs;
    try {
      const manifest = readYaml(path.join(dir, 'pack.yaml')) || {};
      derivedNs = packNamespace(manifest.name || name);
    } catch (e) {
      derivedNs = packNamespace(name);
    }
    if (derivedNs === namespace) {
      matches.push(dir);
    }
  }
  return matches;
}

// Throwing resolution (git sink: a pack MUST exist).
function detectPackDir(cwd, namespace, explicitPack) {
  if (explicitPack) {
    return path.isAbsolute(explicitPack) ? explicitPack : path.join(cwd, explicitPack);
  }
  const matches = findPackMatches(cwd, namespace);
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length === 0) {
    throw new Error(`Could not auto-detect a pack for namespace '${namespace}'. Pass --pack <dir>.`);
  }
  throw new Error(`Multiple linked packs match namespace '${namespace}'. Pass --pack <dir>.`);
}

// Nullable resolution (file sink: a pack MAY be absent -- hobbyist case).
function resolvePackDirOrNull(cwd, namespace, explicitPack) {
  if (explicitPack) {
    return path.isAbsolute(explicitPack) ? explicitPack : path.join(cwd, explicitPack);
  }
  const matches = findPackMatches(cwd, namespace);
  return matches.length === 1 ? matches[0] : null;
}

module.exports = { parseAreaRef, packNamespace, findPackMatches, detectPackDir, resolvePackDirOrNull };
