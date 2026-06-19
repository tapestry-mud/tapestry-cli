'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildTypeScript } = require('../../src/lib/ts-build');

function tmpPack() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'tap-tsbuild-'));
  fs.mkdirSync(path.join(cwd, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'scripts', 'a.ts'), 'export const x: number = 1;\n');
  fs.writeFileSync(path.join(cwd, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'es2020', module: 'esnext', moduleResolution: 'bundler',
      strict: false, noImplicitAny: false, skipLibCheck: true,
      rootDir: 'scripts', outDir: 'dist/scripts',
    },
    include: ['scripts/**/*.ts'],
  }));
  return cwd;
}

test('buildTypeScript compiles an esm pack to dist/scripts', () => {
  const cwd = tmpPack();
  buildTypeScript(cwd, { content: { scripts_format: 'esm' } });
  expect(fs.existsSync(path.join(cwd, 'dist', 'scripts', 'a.js'))).toBe(true);
});

test('buildTypeScript is a no-op for a legacy pack', () => {
  const cwd = tmpPack();
  buildTypeScript(cwd, { content: { scripts_format: 'legacy' } });
  expect(fs.existsSync(path.join(cwd, 'dist'))).toBe(false);
});
