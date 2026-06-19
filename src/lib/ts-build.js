'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

// Compiles an ESM pack's TypeScript (scripts/**/*.ts -> dist/scripts/**/*.js) using the
// bundled tsc and the pack's tsconfig.json. No-op for legacy packs (raw .js, no build).
function buildTypeScript(cwd, manifest) {
  const format = manifest && manifest.content && manifest.content.scripts_format;
  if (format !== 'esm') {
    return;
  }
  const tsc = require.resolve('typescript/bin/tsc');
  const tsconfig = path.join(cwd, 'tsconfig.json');
  console.log('Compiling TypeScript (tsc)...');
  const res = spawnSync(process.execPath, [tsc, '-p', tsconfig], { cwd, stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error('TypeScript compile failed');
  }
}

module.exports = { buildTypeScript };
