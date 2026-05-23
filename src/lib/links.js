'use strict';

const path = require('path');
const fs = require('fs');
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

module.exports = {
  LINKS_FILE, readLinks, writeLinks, addLink, removeLink,
  readPackManifest, packLinkPath, containerPackTarget, dockerLinkMounts,
};
