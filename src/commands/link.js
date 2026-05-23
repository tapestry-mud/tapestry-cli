'use strict';

const fs = require('fs');
const path = require('path');
const {
  readLinks, addLink, removeLink, readPackManifest,
  removeMaterializedLink, checkMissingDeps,
} = require('../lib/links');
const { addPackageToBoot, removePackageFromBoot } = require('../lib/boot');

function requireProject(cwd) {
  if (!fs.existsSync(path.join(cwd, 'tapestry.yaml'))) {
    throw new Error('No tapestry.yaml found. Run `tapestry init` first.');
  }
}

function ensureGitignore(cwd) {
  const gi = path.join(cwd, '.gitignore');
  if (!fs.existsSync(gi)) {
    return;
  }
  const body = fs.readFileSync(gi, 'utf8');
  if (!body.split(/\r?\n/).includes('tapestry-links.yaml')) {
    fs.appendFileSync(gi, `${body.endsWith('\n') ? '' : '\n'}tapestry-links.yaml\n`);
  }
}

async function link(targetPath, { cwd = process.cwd() } = {}) {
  requireProject(cwd);
  const absPath = path.resolve(cwd, targetPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Path not found: ${absPath}`);
  }
  const manifest = readPackManifest(absPath);
  const name = manifest.name;
  if (!name) {
    throw new Error(`Pack at ${absPath} has no 'name' in its manifest`);
  }

  addLink(cwd, name, absPath);
  addPackageToBoot(cwd, name, manifest);
  ensureGitignore(cwd);

  console.log(`linked ${name} -> ${absPath}`);

  if (manifest.active === false) {
    console.warn(`  warning: ${name} is marked active: false; it will not load until activated`);
  }
  for (const dep of checkMissingDeps(cwd, manifest)) {
    const range = manifest.dependencies[dep];
    console.warn(`  warning: missing dependency ${dep} (${range}) -- run: tapestry install ${dep}`);
  }
}

async function unlink(name, { cwd = process.cwd() } = {}) {
  requireProject(cwd);
  if (!removeLink(cwd, name)) {
    throw new Error(`${name} is not linked`);
  }
  removeMaterializedLink(cwd, name);
  removePackageFromBoot(cwd, name);
  console.log(`unlinked ${name}`);
  console.log(`  run 'tapestry install' to restore the registry copy`);
}

async function linkList({ cwd = process.cwd() } = {}) {
  const { links } = readLinks(cwd);
  const entries = Object.entries(links);
  if (entries.length === 0) {
    console.log('No linked packs.');
    return;
  }
  for (const [name, absPath] of entries) {
    const flag = fs.existsSync(absPath) ? '' : '  (MISSING)';
    console.log(`${name} -> ${absPath}${flag}`);
  }
}

module.exports = { link, unlink, linkList };
