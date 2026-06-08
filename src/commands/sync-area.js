'use strict';

const fs = require('fs');
const path = require('path');
const { readYaml } = require('../util/yaml');
const { bumpVersion } = require('../lib/pack-manifest');
const { isRepo, commitAll } = require('../lib/git');
const { packNamespace, detectPackDir, parseAreaRef } = require('../lib/pack-resolve');
const { renderArea, removeSideCars, assertNamespaceMatch } = require('../lib/render-core');

function syncArea(areaRef, options) {
  options = options || {};
  const cwd = options.cwd || process.cwd();
  const gameRoot = options.gameRoot || cwd;
  const force = !!options.force;
  const bumpLevel = options.bump || 'patch';
  const keepSidecars = !!options.keepSidecars;

  const { namespace, area } = parseAreaRef(areaRef);

  const packDir = detectPackDir(cwd, namespace, options.pack);
  const destManifestPath = path.join(packDir, 'pack.yaml');
  if (!fs.existsSync(destManifestPath)) {
    throw new Error(`No pack.yaml found in ${packDir}. harvest --sink git targets an existing pack; pass --pack <dir> pointing at one.`);
  }
  const destManifest = readYaml(destManifestPath) || {};
  assertNamespaceMatch(destManifest, namespace, packDir);

  const { written, files } = renderArea(packDir, { gameRoot, area, force });

  const { old, new: next } = bumpVersion(packDir, bumpLevel);
  let committed = false;
  if (isRepo(packDir)) {
    commitAll(packDir, `content(${area}): sync authored edits, bump ${old} -> ${next}`);
    committed = true;
  } else {
    console.warn(`warn: ${packDir} is not a git repo; bumped to ${next} but did not commit.`);
  }

  if (!keepSidecars) {
    removeSideCars(gameRoot, area, files);
  }

  console.log(`Synced ${written} room(s) for area '${area}' into ${packDir} (v${old} -> v${next}).`);
  if (committed) {
    console.log('To publish + deploy, push the pack repo:');
    console.log(`  cd ${packDir} && git push`);
  }
}

module.exports = { syncArea, exportArea: syncArea, packNamespace, detectPackDir };
