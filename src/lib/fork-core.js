'use strict';

const fs = require('fs');
const path = require('path');
const { readYaml, writeYaml } = require('../util/yaml');
const { renderArea } = require('./render-core');
const { ensureContentGlobs } = require('./pack-manifest');
const { packNamespace } = require('./pack-resolve');

function titleCase(s) {
  return s.split(/[-_]/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Compute ^<major>.<minor>.0 from a semver string.
// '1.4.7' -> '^1.4.0', '0.1.44' -> '^0.1.0' (SA2: foundational section 6 convention).
function caretMinor(version) {
  const parts = version.split('.');
  const maj = parts[0] || '0';
  const min = parts[1] || '0';
  return '^' + maj + '.' + min + '.0';
}

// Recursively replace every string value whose text starts with originNs: with forkNs:.
// Recurses into objects and arrays. All other values pass through unchanged.
function rekeyContent(obj, originNs, forkNs) {
  if (typeof obj === 'string') {
    return obj.startsWith(originNs + ':') ? forkNs + ':' + obj.slice(originNs.length + 1) : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => rekeyContent(v, originNs, forkNs));
  }
  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = rekeyContent(v, originNs, forkNs);
    }
    return result;
  }
  return obj;
}

function walkDir(dir, fn) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, fn);
    } else {
      fn(full);
    }
  }
}

// Walk all *.yaml files under buildDir/areas/ and re-key originNamespace: -> forkNamespace:
// in every string value. Idempotent; safe to call multiple times.
function rekeyArea(buildDir, originNamespace, forkNamespace) {
  const areasDir = path.join(buildDir, 'areas');
  if (!fs.existsSync(areasDir)) {
    return;
  }
  walkDir(areasDir, (filePath) => {
    if (!filePath.endsWith('.yaml')) {
      return;
    }
    const content = readYaml(filePath);
    if (content === null || content === undefined) {
      return;
    }
    const rekeyed = rekeyContent(content, originNamespace, forkNamespace);
    writeYaml(filePath, rekeyed);
  });
}

// Build a fork pack directory: write the fork pack.yaml (provenance + depends-on), render
// side-car content into buildDir, re-key all IDs from originNamespace to forkNamespace,
// ensure content globs. buildDir must not exist yet (or be empty).
// originPackName is the authoritative pack name from the origin's pack.yaml (F5: not derived).
// Returns { forkNamespace, files, version } where files is the room yaml filename list from
// renderArea and version is always '0.1.0' (fork starts fresh).
function buildForkPack(buildDir, {
  gameRoot, area,
  originNamespace, originVersion, originPackName,
  forkPackName, force,
}) {
  const forkNamespace = packNamespace(forkPackName);
  const forkPkgPart = forkPackName.split('/')[1] || forkNamespace;

  fs.mkdirSync(buildDir, { recursive: true });

  writeYaml(path.join(buildDir, 'pack.yaml'), {
    name: forkPackName,
    version: '0.1.0',
    type: 'world',
    display_name: titleCase(forkPkgPart),
    description: 'derivative of ' + originPackName + '@' + originVersion,
    engine: '>=0.1.0',
    validation: 'strict',
    dependencies: { [originPackName]: caretMinor(originVersion) },
  });

  const { files } = renderArea(buildDir, { gameRoot, area, force: !!force });
  rekeyArea(buildDir, originNamespace, forkNamespace);
  ensureContentGlobs(buildDir);

  return { forkNamespace, files, version: '0.1.0' };
}

module.exports = { rekeyContent, rekeyArea, buildForkPack };
