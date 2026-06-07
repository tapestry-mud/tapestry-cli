'use strict';

const fs = require('fs');
const path = require('path');
const { readYaml, writeYaml } = require('../util/yaml');
const { readLinks } = require('../lib/links');
const { ensureContentGlobs } = require('../lib/pack-manifest');

// "@legends/forgotten" -> "legends-forgotten" (mirrors engine PackLoader.PackNamespace)
function packNamespace(name) {
  if (name.indexOf('/') === -1) {
    return name;
  }
  return name.replace(/^@/, '').split('/').join('-');
}

function detectPackDir(cwd, namespace, explicitPack) {
  if (explicitPack) {
    return path.isAbsolute(explicitPack) ? explicitPack : path.join(cwd, explicitPack);
  }
  const { links } = readLinks(cwd);
  const matches = [];
  for (const [name, dir] of Object.entries(links)) {
    let derivedNs = namespace;
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
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length === 0) {
    throw new Error(`Could not auto-detect a pack for namespace '${namespace}'. Pass --pack <dir>.`);
  }
  throw new Error(`Multiple linked packs match namespace '${namespace}'. Pass --pack <dir>.`);
}

function syncArea(areaRef, options) {
  options = options || {};
  const cwd = options.cwd || process.cwd();
  const gameRoot = options.gameRoot || cwd;
  const force = !!options.force;

  const colon = areaRef.indexOf(':');
  if (colon < 1) {
    throw new Error('Usage: sync-area <namespace:area-id> [--pack <dir>]');
  }
  const namespace = areaRef.slice(0, colon);
  const area = areaRef.slice(colon + 1);

  const sideCarRooms = path.join(gameRoot, 'data', 'areas', area, 'rooms');
  if (!fs.existsSync(sideCarRooms)) {
    throw new Error(`No authored rooms found for area '${area}' at ${sideCarRooms}`);
  }
  const files = fs.readdirSync(sideCarRooms).filter((f) => f.endsWith('.yaml'));
  if (files.length === 0) {
    throw new Error(`No authored rooms found for area '${area}'`);
  }

  const packDir = detectPackDir(cwd, namespace, options.pack);

  const destManifest = readYaml(path.join(packDir, 'pack.yaml')) || {};
  const destNamespace = packNamespace(destManifest.name || '');
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

  console.log(`Synced ${written} room(s) for area '${area}' into ${targetRooms}`);
}

module.exports = { syncArea, exportArea: syncArea, packNamespace, detectPackDir };
