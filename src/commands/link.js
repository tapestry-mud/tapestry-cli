'use strict';

const fs = require('fs');
const path = require('path');
const {
  readLinks, addLink, removeLink, readPackManifest,
  removeMaterializedLink, checkMissingDeps, partitionDeps,
} = require('../lib/links');
const { addPackageToBoot, removePackageFromBoot } = require('../lib/boot');
const { resolve } = require('../lib/semver-resolver');
const { installResolved, packInstallPath } = require('./install');
const { readLock, writeLock } = require('../lib/lock-file');
const { loadAccess } = require('../lib/auth');
const { DEFAULT_REGISTRY } = require('../lib/registry-client');

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

async function link(targetPath, { cwd = process.cwd(), noInstall = false, registryUrl = DEFAULT_REGISTRY } = {}) {
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

  // Warn if the pack is marked inactive — fires on all paths
  if (manifest.active === false) {
    console.warn(`  warning: ${name} is marked active: false; it will not load until activated`);
  }

  if (noInstall) {
    console.log(`linked ${name} -> ${absPath}`);
    for (const dep of checkMissingDeps(cwd, manifest)) {
      const range = manifest.dependencies[dep];
      console.warn(`  warning: missing dependency ${dep} (${range}) -- run: tapestry install ${dep}`);
    }
    return;
  }

  const { needsInstall } = partitionDeps(cwd, manifest);

  if (Object.keys(needsInstall).length === 0) {
    console.log(`linked ${name} -> ${absPath}`);
    return;
  }

  let toRollback = [];
  try {
    const token = await loadAccess();
    const resolved = await resolve(needsInstall, registryUrl, token);

    // New installs: not on disk yet. Upgrade targets: in needsInstall AND on disk
    // (installResolved deletes the old dir before downloading; track so rollback removes the boot entry)
    toRollback = [
      ...Object.keys(resolved).filter((n) => !fs.existsSync(packInstallPath(cwd, n))),
      ...Object.keys(needsInstall).filter((n) => fs.existsSync(packInstallPath(cwd, n))),
    ];

    await installResolved(cwd, resolved, token);

    const existingLock = readLock(cwd);
    const mergedResolved = Object.assign({}, (existingLock && existingLock.resolved) || {}, resolved);
    writeLock(cwd, {
      lockfile_version: 1,
      ...(existingLock && existingLock.deps_hash ? { deps_hash: existingLock.deps_hash } : {}),
      resolved: mergedResolved,
    });

    console.log(`linked ${name} -> ${absPath}`);
    for (const [pkgName, info] of Object.entries(resolved)) {
      console.log(`  installed ${pkgName}@${info.version} (dependency of ${name})`);
    }
  } catch (err) {
    removeLink(cwd, name);
    removePackageFromBoot(cwd, name);
    for (const pkgName of toRollback) {
      const installPath = packInstallPath(cwd, pkgName);
      if (fs.existsSync(installPath)) {
        fs.rmSync(installPath, { recursive: true });
      }
      removePackageFromBoot(cwd, pkgName);
    }
    throw new Error(
      `Cannot resolve dependencies for ${name} — ${err.message}. Use --skip-install to link without dependency resolution.`
    );
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
