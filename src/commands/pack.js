'use strict';

const path = require('path');
const { readYaml } = require('../util/yaml');
const { buildTarball, computeIntegrity } = require('../lib/tarball-builder');
const { PACK_MANIFEST } = require('../lib/manifest');
const { validate } = require('./validate');
const { buildTypeScript } = require('../lib/ts-build');

async function pack({ cwd = process.cwd() } = {}) {
  validate({ cwd });

  const manifest = readYaml(path.join(cwd, PACK_MANIFEST));
  buildTypeScript(cwd, manifest);

  const shortName = manifest.name.split('/')[1];
  const outputPath = path.join(cwd, `${shortName}-${manifest.version}.tgz`);

  console.log(`Packing ${manifest.name}@${manifest.version}...`);
  await buildTarball(cwd, outputPath);

  const integrity = computeIntegrity(outputPath);
  console.log(`  ${path.basename(outputPath)}`);
  console.log(`  integrity: ${integrity}`);
  console.log('Done.');
}

module.exports = { pack };
