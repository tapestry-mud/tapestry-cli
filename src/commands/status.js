'use strict';

const { computeAreaStates } = require('../lib/world-state');

function status({ cwd = process.cwd(), gameRoot } = {}) {
  const root = gameRoot || cwd;
  const rows = computeAreaStates(cwd, root);
  if (!rows.length) {
    console.log('No authored areas under data/areas.');
    return;
  }
  console.log('World state (area-level):');
  for (const r of rows) {
    const wipTag = r.wip ? ' [WIP]' : '';
    console.log(`  ${r.state.padEnd(7)} ${r.area} (${r.namespace || '?'}) rooms:${r.roomCount}${wipTag}`);
  }
  console.log('');
  console.log('Clean = shipped; Edited = ready to harvest; Fork = owned by another pack; WIP = hidden from players.');
  console.log('Strict boot remains the authority; this is a lighter on-host view.');
}

module.exports = { status };
