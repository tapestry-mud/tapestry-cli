'use strict';

const fs = require('fs');
const path = require('path');
const { readYaml } = require('../util/yaml');
const { validatePackageManifest } = require('../schema/manifest');
const { PACK_MANIFEST } = require('../lib/manifest');

function validate({ cwd = process.cwd() } = {}) {
  const manifestPath = path.join(cwd, PACK_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    const serverPath = path.join(cwd, 'tapestry.yaml');
    if (fs.existsSync(serverPath)) {
      throw new Error(
        `No ${PACK_MANIFEST} found in current directory. ` +
        `The tapestry.yaml here is a server manifest. ` +
        `Pack validation requires ${PACK_MANIFEST}.`
      );
    }
    throw new Error(`No ${PACK_MANIFEST} found in current directory`);
  }

  const data = readYaml(manifestPath);
  console.log(`Validating ${manifestPath}...`);

  const result = validatePackageManifest(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const fieldPath = issue.path.join('.') || 'root';
      let message = issue.message;
      if (fieldPath === 'engine' && data.engine && typeof data.engine === 'object') {
        message += `. engine must be a version constraint string in pack manifests (e.g. '>=0.0.1'). Object format is for server manifests (tapestry.yaml).`;
      }
      console.log(`  error: ${fieldPath} - ${message}`);
    }
    throw new Error(`${result.error.issues.length} validation error(s)`);
  }

  console.log(`  OK  ${data.name} v${data.version}`);
}

module.exports = { validate };
