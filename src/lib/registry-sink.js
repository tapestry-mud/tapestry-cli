'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { readYaml, writeYaml } = require('../util/yaml');
const { resolvePackDirOrNull } = require('./pack-resolve');
const { renderArea, removeSideCars, assertNamespaceMatch } = require('./render-core');
const { synthesizeManifest, bumpVersion } = require('./pack-manifest');
const { buildTarball, computeIntegrity } = require('./tarball-builder');
const { isRepo } = require('./git');
const { requireAccess } = require('./auth');
const { DEFAULT_REGISTRY, throwIfError } = require('./registry-client');

// Registry sink: render -> tar -> POST /v1/publish.
// Run where the registry token lives (operator machine or no-git server).
// Refuses registry-direct when the linked pack is repo-backed (source-of-truth trap).
//
// Owned (linked pack, not git repo): mirrors the git sink. Renders into the REAL pack dir
// so content accumulates in the operator's source of truth across repeated harvests; bumps;
// tars+POSTs. Edge: if POST fails after render+bump, the real pack holds both - re-running
// re-renders to a no-op and re-bumps (a registry version gap, accepted, source truth intact).
//
// Hobbyist (no linked pack): mirrors the file sink. Synthesizes a manifest, renders into a
// temp dir, tars+POSTs. No persistent bump. A second publish at 0.1.0 will fail at the
// registry - the intended signal to set up a real pack.
async function registrySink(areaRef, options) {
  const { cwd, gameRoot, namespace, area } = options;
  const force = !!options.force;
  const keepSidecars = !!options.keepSidecars;
  const registryUrl = options.registryUrl || DEFAULT_REGISTRY;

  const packDir = resolvePackDirOrNull(cwd, namespace, options.pack);

  if (packDir && isRepo(packDir)) {
    throw new Error(
      `Cannot publish registry-direct: '${packDir}' is a git repo.\n` +
      `Harvest to file instead: tapestry harvest ${areaRef} --sink file\n` +
      `Pull the .tgz to the machine that owns the repo, unpack into the repo, commit, push,\n` +
      `and let CI publish.`
    );
  }

  let files;
  let manifest;
  let tmpBuild = null;
  let tmpTgz;

  try {
    if (packDir) {
      const existingManifest = readYaml(path.join(packDir, 'pack.yaml')) || {};
      assertNamespaceMatch(existingManifest, namespace, packDir);

      // Fail loudly on EACCES before any mutation - never silently.
      try {
        fs.accessSync(packDir, fs.constants.W_OK);
      } catch (e) {
        throw new Error(
          `Cannot write to pack directory ${packDir}: ${e.message}. ` +
          `The user running tapestry may not own that directory.`
        );
      }

      // Render into the REAL pack dir (content accumulates), then bump.
      ({ files } = renderArea(packDir, { gameRoot, area, force }));
      bumpVersion(packDir, options.bump || 'patch');
      manifest = readYaml(path.join(packDir, 'pack.yaml'));
    } else {
      tmpBuild = fs.mkdtempSync(path.join(os.tmpdir(), 'tapestry-harvest-'));
      manifest = synthesizeManifest(namespace, { name: options.name });
      writeYaml(path.join(tmpBuild, 'pack.yaml'), manifest);
      ({ files } = renderArea(tmpBuild, { gameRoot, area, force }));
      // Re-read after render in case ensureContentGlobs updated the manifest.
      manifest = readYaml(path.join(tmpBuild, 'pack.yaml'));
    }

    const buildDir = tmpBuild || packDir;
    const shortName = manifest.name.split('/')[1];
    tmpTgz = path.join(os.tmpdir(), `tapestry-publish-${shortName}-${manifest.version}.tgz`);

    await buildTarball(buildDir, tmpTgz);
    const integrity = computeIntegrity(tmpTgz);
    const token = await requireAccess();

    const form = new FormData();
    form.append('tarball', fs.createReadStream(tmpTgz), {
      filename: `${manifest.version}.tgz`,
      contentType: 'application/gzip',
    });
    form.append('metadata', JSON.stringify({ ...manifest, integrity }));

    const res = await fetch(`${registryUrl}/v1/publish`, {
      method: 'POST',
      headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
      body: form,
    });
    await throwIfError(res, 'Publish failed');
    const result = await res.json();

    if (!keepSidecars) {
      removeSideCars(gameRoot, area, files);
    }
    console.log(`Harvested area '${area}' and published ${result.name}@${result.version}.`);
    console.log('Run `tapestry update` on your game server to pull the new version.');
  } finally {
    if (tmpTgz && fs.existsSync(tmpTgz)) {
      fs.unlinkSync(tmpTgz);
    }
    if (tmpBuild) {
      fs.rmSync(tmpBuild, { recursive: true, force: true });
    }
  }
}

module.exports = { registrySink };
