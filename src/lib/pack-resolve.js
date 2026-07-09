'use strict';

const path = require('path');
const { readYaml } = require('../util/yaml');
const { readLinks } = require('./links');
const { readSession, decodeScopes } = require('./auth');

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

// Whether a namespace is owned by the given operator scope (SA5 prefix rule): exact match, or
// the namespace is scope-prefixed with a following dash. 'tapestry-core' is owned by scope
// 'tapestry'; 'my-org-core' is owned by scope 'my-org' (a hyphenated handle) - do NOT extract
// a scope from the namespace by splitting on the first dash, that misclassifies every
// hyphenated handle's own content as a fork (SA5). The namespace flattening is lossy by
// construction (@my/org-core and @my-org/core both map to namespace 'my-org-core'), so scope
// 'my' also reads as owning 'my-org-core' - an accepted residual (SA5), not a defect.
function isOwnedNamespace(namespace, scope) {
  return namespace === scope || namespace.startsWith(scope + '-');
}

// The operator's registry scope (account handle), decoded from the local auth session - the
// same ~/.tapestryrc session requireAccess() reads for publish. Returns the first entry of
// the access token's `scopes` claim, or null if there is no session, no access token, or no
// scopes claim. Durable across `tapestry link`/`unlink`: never touches tapestry-links.yaml.
function resolveOperatorScope() {
  const session = readSession();
  if (!session || !session.access) {
    return null;
  }
  const scopes = decodeScopes(session.access);
  return (scopes && scopes[0]) || null;
}

module.exports = {
  parseAreaRef, packNamespace, findPackMatches, detectPackDir, resolvePackDirOrNull,
  isOwnedNamespace, resolveOperatorScope,
};
