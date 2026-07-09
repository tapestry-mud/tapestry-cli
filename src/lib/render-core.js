'use strict';

const fs = require('fs');
const path = require('path');
const { readYaml, writeYaml } = require('../util/yaml');
const { ensureContentGlobs } = require('./pack-manifest');
const { packNamespace } = require('./pack-resolve');

// Recursively collect files matching a name predicate under a directory.
// Returns absolute paths.
function collectFiles(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      collectFiles(path.join(dir, entry.name), predicate, results);
    } else if (predicate(entry.name)) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

// Copy oracle side-car yaml files from the area source root into the area dest root,
// preserving relative paths and applying the divergence guard.
function copyOracleSideCars(areaSrcRoot, areaDestRoot, force) {
  const oracleFiles = collectFiles(areaSrcRoot, (name) => {
    return name === 'places-oracle.yaml' || name.endsWith('-oracle-table.yaml');
  });
  for (const src of oracleFiles) {
    const rel = path.relative(areaSrcRoot, src);
    const dest = path.join(areaDestRoot, rel);
    const incoming = readYaml(src);
    if (fs.existsSync(dest) && !force) {
      const existing = readYaml(dest);
      if (JSON.stringify(existing) !== JSON.stringify(incoming)) {
        throw new Error(
          `Pack file ${dest} diverges from the side-car. Review the diff and re-run with --force to overwrite.`);
      }
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    writeYaml(dest, incoming);
  }
}

// Fold one area's authored side-cars into a target pack directory. Setup-independent:
// it does not know whether targetDir is a real repo or a temp build dir.
// Returns { written, files }. Throws if there is nothing to render or a pack file diverges.
function renderArea(targetDir, { gameRoot, area, force = false }) {
  const sideCarRooms = path.join(gameRoot, 'data', 'areas', area, 'rooms');
  if (!fs.existsSync(sideCarRooms)) {
    throw new Error(`No authored rooms found for area '${area}' at ${sideCarRooms}`);
  }
  const files = fs.readdirSync(sideCarRooms).filter((f) => f.endsWith('.yaml'));
  if (files.length === 0) {
    throw new Error(`No authored rooms found for area '${area}'`);
  }

  const targetRooms = path.join(targetDir, 'areas', area, 'rooms');
  fs.mkdirSync(targetRooms, { recursive: true });

  // area.yaml: copy the authored envelope through; else leave the pack's; else synthesize.
  const sideCarAreaYaml = path.join(gameRoot, 'data', 'areas', area, 'area.yaml');
  const targetAreaYaml = path.join(targetDir, 'areas', area, 'area.yaml');
  if (fs.existsSync(sideCarAreaYaml)) {
    writeYaml(targetAreaYaml, readYaml(sideCarAreaYaml));
  } else if (!fs.existsSync(targetAreaYaml)) {
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

  // Copy oracle table side-cars: places-oracle.yaml at the area root,
  // and any *-oracle-table.yaml files in subdirectories (mobs/, items/, etc.).
  const areaSrcRoot = path.join(gameRoot, 'data', 'areas', area);
  const areaDestRoot = path.join(targetDir, 'areas', area);
  copyOracleSideCars(areaSrcRoot, areaDestRoot, force);

  // Copy minted mob and item instance files (including their *-oracle-table.yaml).
  for (const sub of ['mobs', 'items']) {
    const srcDir = path.join(gameRoot, 'data', 'areas', area, sub);
    if (fs.existsSync(srcDir)) {
      const subFiles = fs.readdirSync(srcDir).filter((f) => f.endsWith('.yaml'));
      const destDir = path.join(targetDir, 'areas', area, sub);
      fs.mkdirSync(destDir, { recursive: true });
      for (const file of subFiles) {
        const src = path.join(srcDir, file);
        const dest = path.join(destDir, file);
        const incoming = readYaml(src);
        if (fs.existsSync(dest) && !force) {
          const existing = readYaml(dest);
          if (JSON.stringify(existing) !== JSON.stringify(incoming)) {
            throw new Error(
              `Pack file ${dest} diverges from the side-car. Review the diff and re-run with --force to overwrite.`);
          }
        }
        writeYaml(dest, incoming);
      }
    }
  }

  ensureContentGlobs(targetDir);
  reconcileDependencies(targetDir, area);

  return { written, files };
}

// Designed-in seam (design section 6): scan harvested content for cross-pack references and
// write a `dependencies` block into the target pack.yaml, hard-erroring on the unresolvable.
// Rooms are self-contained (their only cross-pack edge is the runtime-only `link` seam, which
// never bakes into the artifact), so this is a deliberate NO-OP until referential side-cars
// (mobs/items/quests) exist. Wired now so the slice-5 dependency stage slots in, not bolts on.
function reconcileDependencies(targetDir, area) {
  return [];
}

// Move semantics: delete the game-root side-cars for an area once the content is durably
// promoted. Idempotent; prunes the rooms/ and area dirs when they go empty.
function removeSideCars(gameRoot, area, files) {
  const sideCarRooms = path.join(gameRoot, 'data', 'areas', area, 'rooms');
  const areaSideCarDir = path.join(gameRoot, 'data', 'areas', area);
  for (const file of files) {
    const p = path.join(sideCarRooms, file);
    if (fs.existsSync(p)) {
      fs.rmSync(p);
    }
  }
  if (fs.existsSync(sideCarRooms) && fs.readdirSync(sideCarRooms).length === 0) {
    fs.rmdirSync(sideCarRooms);
  }
  const areaYaml = path.join(areaSideCarDir, 'area.yaml');
  if (fs.existsSync(areaYaml)) {
    fs.rmSync(areaYaml);
  }
  if (fs.existsSync(areaSideCarDir) && fs.readdirSync(areaSideCarDir).length === 0) {
    fs.rmdirSync(areaSideCarDir);
  }
}

// Namespace guard: a sink may only fold an area into its OWN pack. Throws on mismatch.
function assertNamespaceMatch(manifest, namespace, packDir) {
  if (!manifest.name) {
    throw new Error(`pack.yaml in ${packDir} has no 'name' field.`);
  }
  const destNamespace = packNamespace(manifest.name);
  if (destNamespace !== namespace) {
    throw new Error(
      `Pack namespace '${destNamespace}' does not match area namespace '${namespace}'. ` +
      'harvest only commits an area back into its own pack; not-owned content forks ' +
      '(log in with \'tapestry login\' to enable forking).');
  }
}

module.exports = { renderArea, reconcileDependencies, removeSideCars, assertNamespaceMatch };
