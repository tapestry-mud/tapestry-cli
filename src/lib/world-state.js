'use strict';

const fs = require('fs');
const path = require('path');
const { readYaml } = require('../util/yaml');
const { resolvePackDirOrNull } = require('./pack-resolve');

// The one state vocabulary (design section 7), spec'd here for the CLI view. The in-game
// `areas` view shows engine provenance tags ([pack]/[authored]/[pack +edits]) plus a WIP
// tag; both are views of these same on-disk facts. Strict boot stays the authority.
const STATES = { CLEAN: 'Clean', EDITED: 'Edited', FORK: 'Fork', WIP: 'WIP' };
const WIP_FLAG = 'wip';

function areaIsWip(areaDir) {
  const areaYaml = path.join(areaDir, 'area.yaml');
  if (!fs.existsSync(areaYaml)) {
    return false;
  }
  const env = readYaml(areaYaml) || {};
  const flags = (env.area && env.area.flags) || [];
  return Array.isArray(flags) && flags.includes(WIP_FLAG);
}

// Lighter mirror of in-game `areas`: classify each authored area from side-car facts alone.
// Never queries the registry or resolves the reference graph.
function computeAreaStates(cwd, gameRoot) {
  const areasRoot = path.join(gameRoot, 'data', 'areas');
  if (!fs.existsSync(areasRoot)) {
    return [];
  }
  const rows = [];
  for (const area of fs.readdirSync(areasRoot)) {
    const areaDir = path.join(areasRoot, area);
    if (!fs.statSync(areaDir).isDirectory()) {
      continue;
    }
    const roomsDir = path.join(areaDir, 'rooms');
    const roomFiles = fs.existsSync(roomsDir)
      ? fs.readdirSync(roomsDir).filter((f) => f.endsWith('.yaml'))
      : [];

    // Namespace is carried in the side-car room ids (ns:key).
    let namespace = null;
    if (roomFiles.length) {
      const first = readYaml(path.join(roomsDir, roomFiles[0])) || {};
      if (typeof first.id === 'string' && first.id.includes(':')) {
        namespace = first.id.split(':')[0];
      }
    }

    const wip = areaIsWip(areaDir);
    const packDir = namespace ? resolvePackDirOrNull(cwd, namespace, undefined) : null;
    const owned = !!packDir;

    let state;
    if (wip) {
      state = STATES.WIP;
    } else if (roomFiles.length === 0) {
      state = STATES.CLEAN;
    } else if (!owned) {
      // Namespace maps to no pack you own (official/foreign) -> a fork target (slice 3).
      state = STATES.FORK;
    } else {
      const edited = roomFiles.some((f) => {
        const packRoom = path.join(packDir, 'areas', area, 'rooms', f);
        if (!fs.existsSync(packRoom)) {
          return true; // new room not yet in the pack
        }
        return JSON.stringify(readYaml(packRoom)) !== JSON.stringify(readYaml(path.join(roomsDir, f)));
      });
      state = edited ? STATES.EDITED : STATES.CLEAN;
    }

    rows.push({ area, namespace, state, roomCount: roomFiles.length, wip });
  }
  return rows.sort((a, b) => a.area.localeCompare(b.area));
}

module.exports = { computeAreaStates, STATES, WIP_FLAG };
