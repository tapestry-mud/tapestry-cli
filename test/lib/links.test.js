'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { readLinks, writeLinks, addLink, removeLink, LINKS_FILE } = require('../../src/lib/links');

let tmpDir;
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tapestry-links-')); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true }); });

describe('links file I/O', () => {
  it('returns empty links when no file exists', () => {
    expect(readLinks(tmpDir)).toEqual({ version: 1, links: {} });
  });

  it('addLink writes a name -> path entry', () => {
    addLink(tmpDir, '@mallek/legends-forgotten', 'D:/Skunkworks/legends-forgotten');
    expect(readLinks(tmpDir).links).toEqual({ '@mallek/legends-forgotten': 'D:/Skunkworks/legends-forgotten' });
    expect(fs.existsSync(path.join(tmpDir, LINKS_FILE))).toBe(true);
  });

  it('addLink updates an existing name (idempotent path swap)', () => {
    addLink(tmpDir, '@mallek/lf', '/a');
    addLink(tmpDir, '@mallek/lf', '/b');
    expect(readLinks(tmpDir).links['@mallek/lf']).toBe('/b');
  });

  it('removeLink deletes the entry and returns true; false when absent', () => {
    addLink(tmpDir, '@mallek/lf', '/a');
    expect(removeLink(tmpDir, '@mallek/lf')).toBe(true);
    expect(readLinks(tmpDir).links).toEqual({});
    expect(removeLink(tmpDir, '@mallek/lf')).toBe(false);
  });
});
