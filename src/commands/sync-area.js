'use strict';

const fs = require('fs');
const path = require('path');
const { readYaml, writeYaml } = require('../util/yaml');
const { ensureContentGlobs, bumpVersion } = require('../lib/pack-manifest');
const { isRepo, commitAll } = require('../lib/git');
const { packNamespace, detectPackDir, parseAreaRef } = require('../lib/pack-resolve');

function syncArea(areaRef, options) {
  options = options || {};
  const cwd = options.cwd || process.cwd();
  const gameRoot = options.gameRoot || cwd;
  const force = !!options.force;
  const bumpLevel = options.bump || 'patch';
  const keepSidecars = !!options.keepSidecars;

  const { namespace, area } = parseAreaRef(areaRef);

  const sideCarRooms = path.join(gameRoot, 'data', 'areas', area, 'rooms');
  if (!fs.existsSync(sideCarRooms)) {
    throw new Error(`No authored rooms found for area '${area}' at ${sideCarRooms}`);
  }
  const files = fs.readdirSync(sideCarRooms).filter((f) => f.endsWith('.yaml'));
  if (files.length === 0) {
    throw new Error(`No authored rooms found for area '${area}'`);
  }

  const packDir = detectPackDir(cwd, namespace, options.pack);

  const destManifestPath = path.join(packDir, 'pack.yaml');
  if (!fs.existsSync(destManifestPath)) {
    throw new Error(`No pack.yaml found in ${packDir}. sync-area targets an existing pack; pass --pack <dir> pointing at one.`);
  }
  const destManifest = readYaml(destManifestPath) || {};
  if (!destManifest.name) {
    throw new Error(`pack.yaml in ${packDir} has no 'name' field.`);
  }
  const destNamespace = packNamespace(destManifest.name);
  if (destNamespace !== namespace) {
    throw new Error(
      `Pack namespace '${destNamespace}' does not match area namespace '${namespace}'. ` +
      'sync-area only commits an area back into its own pack; use link (or a future migrate) for cross-pack moves.'
    );
  }

  const targetRooms = path.join(packDir, 'areas', area, 'rooms');
  fs.mkdirSync(targetRooms, { recursive: true });

  const sideCarAreaYaml = path.join(gameRoot, 'data', 'areas', area, 'area.yaml');
  const targetAreaYaml = path.join(packDir, 'areas', area, 'area.yaml');
  if (fs.existsSync(sideCarAreaYaml)) {
    // Authored area.yaml already carries the full `area:` envelope (Spec A) — copy it home.
    writeYaml(targetAreaYaml, readYaml(sideCarAreaYaml));
  } else if (!fs.existsSync(targetAreaYaml)) {
    // No authored or pack area.yaml — synthesize a minimal valid envelope so it strict-boots.
    writeYaml(targetAreaYaml, {
      area: { id: area, name: area, level_range: [1, 99], reset_interval: 300 },
    });
  }

  let written = 0;
  for (const file of files) {
    const src = path.join(sideCarRooms, file);
    const dest = path.join(targetRooms, file);
    const incoming = readYaml(src);
    if (fs.existsSync(dest) && !force) {
      const existing = readYaml(dest);
      if (JSON.stringify(existing) !== JSON.stringify(incoming)) {
        throw new Error(
          `Pack file ${dest} diverges from the side-car. Review the diff and re-run with --force to overwrite.`);
      }
    }
    writeYaml(dest, incoming);
    written++;
  }

  ensureContentGlobs(packDir);

  const { old, new: next } = bumpVersion(packDir, bumpLevel);
  let committed = false;
  if (isRepo(packDir)) {
    commitAll(packDir, `content(${area}): sync authored edits, bump ${old} -> ${next}`);
    committed = true;
  } else {
    console.warn(`warn: ${packDir} is not a git repo; bumped to ${next} but did not commit.`);
  }

  // Move = delete the game-root side-cars now that the content is durably in the pack.
  // Runs after the write/commit above. In the non-git fallback the content is written
  // (not committed); deletion is still correct because the pack dir holds the files.
  if (!keepSidecars) {
    const areaSideCarDir = path.join(gameRoot, 'data', 'areas', area);
    for (const file of files) {
      fs.rmSync(path.join(sideCarRooms, file));
    }
    if (fs.existsSync(sideCarRooms) && fs.readdirSync(sideCarRooms).length === 0) {
      fs.rmdirSync(sideCarRooms);
    }
    const sideCarAreaYamlToDelete = path.join(areaSideCarDir, 'area.yaml');
    if (fs.existsSync(sideCarAreaYamlToDelete)) {
      fs.rmSync(sideCarAreaYamlToDelete);
    }
    if (fs.existsSync(areaSideCarDir) && fs.readdirSync(areaSideCarDir).length === 0) {
      fs.rmdirSync(areaSideCarDir);
    }
  }

  console.log(`Synced ${written} room(s) for area '${area}' into ${packDir} (v${old} -> v${next}).`);
  if (committed) {
    console.log('To publish + deploy, push the pack repo:');
    console.log(`  cd ${packDir} && git push`);
  }
}

module.exports = { syncArea, exportArea: syncArea, packNamespace, detectPackDir };
