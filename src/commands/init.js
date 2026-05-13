'use strict';

const fs = require('fs');
const path = require('path');
const { fetchPreset, DEFAULT_REGISTRY } = require('../lib/registry-client');

function buildManifest(name, deps) {
  const depLines = Object.entries(deps).map(([pkg, range]) => `  '${pkg}': '${range}'`).join('\n');
  return [
    `name: ${name}`,
    `engine:`,
    `  version: '0.0.1'`,
    `  mode: docker`,
    `  image: ghcr.io/tapestry-mud/tapestry`,
    `dependencies:`,
    depLines,
    `  # Add more packs here. Run: tapestry install @scope/pack-name`,
    `packs: []`,
    `tag_validation: strict`,
    ``,
  ].join('\n');
}

async function init(cwd, { registryUrl = DEFAULT_REGISTRY } = {}) {
  if (cwd === undefined) {
    cwd = process.cwd();
  }

  const manifestPath = path.join(cwd, 'tapestry.yaml');
  if (fs.existsSync(manifestPath)) {
    throw new Error('tapestry.yaml already exists. Run tapestry install to install dependencies.');
  }

  let preset;
  try {
    preset = await fetchPreset('starter', registryUrl);
  } catch (e) {
    throw new Error(`Failed to fetch starter preset from registry: ${e.message}. Check your connection and try again.`);
  }

  console.log(`Initializing Tapestry Starter v${preset.version}`);

  const deps = {};
  for (const [pkg, ver] of Object.entries(preset.packs)) {
    deps[pkg] = `^${ver}`;
  }

  const name = path.basename(cwd);
  fs.writeFileSync(manifestPath, buildManifest(name, deps));
  fs.writeFileSync(path.join(cwd, 'server.yaml'), '# Tapestry server configuration\n# See https://tapestryengine.com/docs/config for full options\nport: 4000\n');
  fs.mkdirSync(path.join(cwd, 'packs'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, '.gitignore'),
    '# Installed packages (managed by tapestry install)\npacks/\n\n# Engine artifacts (managed by tapestry engine install)\n.tapestry-engine/\n\n# Game data (players, saves)\ndata/\n'
  );

  console.log(`Initialized: ${name}`);
  console.log('  tapestry.yaml  project manifest');
  console.log('  server.yaml    engine config');
  console.log('  packs/         installed packages');
  console.log('  .gitignore     excludes packs/ and .tapestry-engine/ from git');

  if (!fs.existsSync(path.join(cwd, '.git'))) {
    console.log('\nHint: no git repo detected. Run: git init');
  }

  console.log('\nNext: run tapestry install, then tapestry engine install, then tapestry start');
}

module.exports = { init };
