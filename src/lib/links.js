'use strict';

const path = require('path');
const fs = require('fs');
const { readYaml, writeYaml } = require('../util/yaml');

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

module.exports = { LINKS_FILE, readLinks, writeLinks, addLink, removeLink };
