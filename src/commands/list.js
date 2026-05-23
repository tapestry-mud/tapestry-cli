'use strict';

const fs = require('fs');
const path = require('path');
const { readLock } = require('../lib/lock-file');
const { readBoot } = require('../lib/boot');
const { readYaml } = require('../util/yaml');
const { PACK_MANIFEST } = require('../lib/manifest');
const { readLinks } = require('../lib/links');

function packInstallPath(cwd, packageName) {
  const parts = packageName.split('/');
  return path.join(cwd, 'packs', ...parts);
}

async function list({ cwd = process.cwd() } = {}) {
  const lock = readLock(cwd);
  if (lock && lock.resolved && Object.keys(lock.resolved).length) {
    const boot = readBoot(cwd);
    const packages = Object.entries(lock.resolved);

    const nameWidth = Math.max(7, ...packages.map(([n]) => n.length));
    const verWidth = Math.max(7, ...packages.map(([, r]) => r.version.length));

    console.log(
      `${'PACKAGE'.padEnd(nameWidth)}  ${'VERSION'.padEnd(verWidth)}  TYPE      STATUS`
    );

    for (const [pkgName, resolved] of packages) {
      const enabled = boot.packs[pkgName]?.enabled !== false ? 'enabled' : 'disabled';

      let type = '';
      const packManifestPath = path.join(packInstallPath(cwd, pkgName), PACK_MANIFEST);
      if (fs.existsSync(packManifestPath)) {
        try {
          type = readYaml(packManifestPath).type || '';
        } catch {
          //
        }
      }

      console.log(
        `${pkgName.padEnd(nameWidth)}  ${resolved.version.padEnd(verWidth)}  ${type.padEnd(8)}  ${enabled}`
      );
    }
  } else {
    console.log('No packages installed.');
  }

  const { links } = readLinks(cwd);
  const linkEntries = Object.entries(links);
  if (linkEntries.length) {
    console.log('\nLinked:');
    for (const [name, absPath] of linkEntries) {
      const flag = fs.existsSync(absPath) ? '' : '  (MISSING)';
      console.log(`  ${name} -> ${absPath}${flag}`);
    }
  }
}

module.exports = { list };
