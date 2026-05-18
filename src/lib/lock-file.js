'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { readYaml, writeYaml } = require('../util/yaml');

const LOCK_FILE = 'tapestry-lock.yaml';

function hashDeps(deps) {
  const sorted = Object.keys(deps).sort().map((k) => `${k}@${deps[k]}`).join('\n');
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

function readLock(cwd) {
  const lockPath = path.join(cwd, LOCK_FILE);
  if (!fs.existsSync(lockPath)) {
    return null;
  }
  return readYaml(lockPath);
}

function writeLock(cwd, lock) {
  writeYaml(path.join(cwd, LOCK_FILE), lock);
}

module.exports = { readLock, writeLock, hashDeps };
