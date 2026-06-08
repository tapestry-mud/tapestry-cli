'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { readYaml, writeYaml } = require('../util/yaml');
const { resolvePackDirOrNull } = require('./pack-resolve');
const { renderArea, removeSideCars, assertNamespaceMatch } = require('./render-core');
const { synthesizeManifest } = require('./pack-manifest');
const { buildTarball, EXCLUDE } = require('./tarball-builder');

// Reuse tarball-builder's exclusion set (single source of truth) for the temp-dir copy filter.
function isExcluded(srcPath) {
  return EXCLUDE.has(path.basename(srcPath)) || srcPath.endsWith('.tgz');
}

// File sink: render into a temp build dir, tar -> <short>-<version>.tgz. It NEVER bumps -- it
// captures an exact snapshot at the current manifest version (synthesized = 0.1.0; owned =
// the pack's current version). A backup/handoff copy, never a claimed source of truth, so a
// shared version string is safe (a .tgz install is a direct file install, not a registry
// resolve). Async so the temp dir is cleaned only AFTER the tarball is fully written.
async function fileSink(areaRef, options) {
  const { cwd, gameRoot, namespace, area } = options;
  const force = !!options.force;
  const keepSidecars = !!options.keepSidecars;

  const packDir = resolvePackDirOrNull(cwd, namespace, options.pack);
  const tmpBuild = fs.mkdtempSync(path.join(os.tmpdir(), 'tapestry-harvest-'));
  try {
    if (packDir) {
      const manifest = readYaml(path.join(packDir, 'pack.yaml')) || {};
      assertNamespaceMatch(manifest, namespace, packDir);
      // Complete-pack copy so the .tgz carries the whole pack (incl. module code), area folded in.
      fs.cpSync(packDir, tmpBuild, { recursive: true, filter: (src) => !isExcluded(src) });
    } else {
      writeYaml(path.join(tmpBuild, 'pack.yaml'), synthesizeManifest(namespace, { name: options.name }));
    }

    const { files } = renderArea(tmpBuild, { gameRoot, area, force });

    // Snapshot semantics: ship at the current manifest version, never bump.
    const manifest = readYaml(path.join(tmpBuild, 'pack.yaml'));
    const version = manifest.version;
    const shortName = manifest.name.split('/')[1];
    const outputPath = options.out
      ? (path.isAbsolute(options.out) ? options.out : path.join(cwd, options.out))
      : path.join(cwd, `${shortName}-${version}.tgz`);

    await buildTarball(tmpBuild, outputPath);

    if (!keepSidecars) {
      removeSideCars(gameRoot, area, files);
    }
    console.log(`Harvested area '${area}' -> ${outputPath} (v${version}).`);
    console.log('This .tgz is a portable, installable pack -- back it up, share it, or `tapestry install` it.');
    return outputPath;
  } finally {
    fs.rmSync(tmpBuild, { recursive: true, force: true });
  }
}

module.exports = { fileSink };
