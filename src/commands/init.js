'use strict';

const fs = require('fs');
const path = require('path');

function buildManifest(name) {
  return [
    `name: ${name}`,
    `engine:`,
    `  version: '0.0.1'`,
    `  mode: docker`,
    `  image: ghcr.io/tapestry-mud/tapestry`,
    `dependencies:`,
    `  '@tapestry/core': '^0.0.1'`,
    `  # Starter races, classes, and tutorial area. Remove or replace with your own content pack.`,
    `  '@tapestry/example-pack': '^0.0.1'`,
    `packs: []`,
    `tag_validation: strict`,
    ``,
  ].join('\n');
}

function init(cwd) {
  {
    if (cwd === undefined) {
      {
        cwd = process.cwd();
      }
    }

    const manifestPath = path.join(cwd, 'tapestry.yaml');
    if (fs.existsSync(manifestPath)) {
      {
        throw new Error('tapestry.yaml already exists. Run tapestry install to install dependencies.');
      }
    }

    const name = path.basename(cwd);
    fs.writeFileSync(manifestPath, buildManifest(name));
    fs.writeFileSync(path.join(cwd, 'server.yaml'), '# Tapestry server configuration\n# See https://tapestryengine.com/docs/config for full options\nport: 4000\n');
    fs.mkdirSync(path.join(cwd, 'packs'), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, '.gitignore'),
      '# Installed packages (managed by tapestry install)\npacks/\n\n# Engine artifacts (managed by tapestry engine install)\n.tapestry-engine/\n'
    );

    console.log(`Initialized: ${name}`);
    console.log('  tapestry.yaml  project manifest');
    console.log('  server.yaml    engine config');
    console.log('  packs/         installed packages');
    console.log('  .gitignore     excludes packs/ and .tapestry-engine/ from git');

    if (!fs.existsSync(path.join(cwd, '.git'))) {
      {
        console.log('\nHint: no git repo detected. Run: git init');
      }
    }

    console.log('\nNext: run tapestry install, then tapestry engine install, then tapestry start');
  }
}

module.exports = { init };
