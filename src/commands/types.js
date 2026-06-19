'use strict';

const fs = require('fs');
const path = require('path');

function types({ cwd = process.cwd() } = {}) {
  const src = path.join(__dirname, '..', '..', 'types', 'tapestry-engine.d.ts');
  const destDir = path.join(cwd, 'types');
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, 'tapestry-engine.d.ts');
  fs.copyFileSync(src, dest);
  console.log(`Wrote ${path.relative(cwd, dest)}`);
}

module.exports = { types };
