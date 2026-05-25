'use strict';

const path = require('path');
const fs = require('fs');
const semver = require('semver');
const { readYaml, writeYaml } = require('../util/yaml');
const { PACK_MANIFEST } = require('./manifest');

const LINKS_FILE = 'tapestry-links.yaml';

function readLinks(cwd) {
  const p = path.join(cwd, LINKS_FILE);
  if (!fs.existsSync(p)) {
    return { version: 1, links: {} };
  }
  const data = readYaml(p) || {};
  return { version: data.version || 1, links: data.links || {} };
}

function writeLinks(cwd, data) {
  writeYaml(path.join(cwd, LINKS_FILE), { version: 1, links: data.links || {} });
}

function addLink(cwd, name, absPath) {
  const data = readLinks(cwd);
  data.links[name] = absPath;
  writeLinks(cwd, data);
}

function removeLink(cwd, name) {
  const data = readLinks(cwd);
  if (!(name in data.links)) {
    return false;
  }
  delete data.links[name];
  writeLinks(cwd, data);
  return true;
}

function readPackManifest(packDir) {
  let p = path.join(packDir, PACK_MANIFEST);
  if (!fs.existsSync(p)) {
    p = path.join(packDir, 'tapestry.yaml');
  }
  if (!fs.existsSync(p)) {
    throw new Error(`${packDir} is not a pack (no pack.yaml or tapestry.yaml)`);
  }
  return readYaml(p) || {};
}

function packLinkPath(cwd, name) {
  return path.join(cwd, 'packs', ...name.split('/'));
}

function containerPackTarget(name) {
  return `/app/packs/${name}`;
}

function dockerLinkMounts(cwd) {
  const { links } = readLinks(cwd);
  const args = [];
  for (const [name, absPath] of Object.entries(links)) {
    args.push('-v', `${absPath}:${containerPackTarget(name)}`);
  }
  return args;
}

function lexists(p) {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function symlinkType() {
  return process.platform === 'win32' ? 'junction' : 'dir';
}

function materializeLinks(cwd) {
  const { links } = readLinks(cwd);
  for (const [name, absPath] of Object.entries(links)) {
    if (!fs.existsSync(absPath)) {
      throw new Error(`Linked pack '${name}' points to ${absPath}, which no longer exists. Run 'tapestry unlink ${name}' or restore the path.`);
    }
    const linkPath = packLinkPath(cwd, name);
    if (lexists(linkPath)) {
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(absPath, linkPath, symlinkType());
  }
}

function removeMaterializedLink(cwd, name) {
  const linkPath = packLinkPath(cwd, name);
  if (lexists(linkPath)) {
    fs.rmSync(linkPath, { recursive: true, force: true });
  }
}

function checkMissingDeps(cwd, manifest) {
  const deps = (manifest && manifest.dependencies) || {};
  const { links } = readLinks(cwd);
  const missing = [];
  for (const depName of Object.keys(deps)) {
    const installed = fs.existsSync(packLinkPath(cwd, depName));
    const linked = depName in links;
    if (!installed && !linked) {
      missing.push(depName);
    }
  }
  return missing;
}

function partitionDeps(cwd, manifest) {
  const deps = (manifest && manifest.dependencies) || {};
  const needsInstall = {};
  if (Object.keys(deps).length === 0) {
    return { needsInstall };
  }
  const { links } = readLinks(cwd);
  for (const [depName, range] of Object.entries(deps)) {
    if (depName in links) {
      continue;
    }
    const installPath = packLinkPath(cwd, depName);
    if (fs.existsSync(installPath)) {
      const manifestPath = path.join(installPath, PACK_MANIFEST);
      if (fs.existsSync(manifestPath)) {
        const installed = readYaml(manifestPath) || {};
        if (installed.version && semver.satisfies(installed.version, range)) {
          continue;
        }
      }
    }
    needsInstall[depName] = range;
  }
  return { needsInstall };
}

module.exports = {
  LINKS_FILE, readLinks, writeLinks, addLink, removeLink,
  readPackManifest, packLinkPath, containerPackTarget, dockerLinkMounts,
  materializeLinks, removeMaterializedLink, checkMissingDeps, partitionDeps,
};
