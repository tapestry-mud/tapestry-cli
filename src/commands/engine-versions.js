'use strict';

const fetch = require('node-fetch');
const { DEFAULT_REGISTRY } = require('../lib/registry-client');

async function engineVersions() {
  const res = await fetch(`${DEFAULT_REGISTRY}/v1/engine-channels`);
  if (!res.ok) {
    throw new Error(`Registry error ${res.status}`);
  }
  const channels = await res.json();

  if (channels.length === 0) {
    console.log('No engine channels registered.');
    return;
  }

  const COL = [10, 10, 22];
  const pad = (s, w) => String(s).padEnd(w);

  console.log([pad('Channel', COL[0]), pad('Version', COL[1]), pad('Updated', COL[2])].join('  '));
  console.log(COL.map(w => '-'.repeat(w)).join('  '));

  for (const ch of channels) {
    const date = new Date(ch.updated_at).toLocaleString('en-US', {
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    console.log([pad(ch.channel, COL[0]), pad(ch.version, COL[1]), pad(date, COL[2])].join('  '));
  }
}

module.exports = { engineVersions };
