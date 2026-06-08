'use strict';

const { parseAreaRef, resolvePackDirOrNull } = require('../lib/pack-resolve');
const { isRepo } = require('../lib/git');
const { syncArea } = require('./sync-area');
const { fileSink } = require('../lib/file-sink');

// Umbrella harvest verb. Auto-detects the sink (owned linked pack that is a git repo -> git;
// else file) unless --sink is explicit. The render core is shared by every sink.
async function harvest(areaRef, options = {}) {
  const cwd = options.cwd || process.cwd();
  const gameRoot = options.gameRoot || cwd;
  const { namespace, area } = parseAreaRef(areaRef);

  let sink = options.sink;
  if (!sink) {
    const packDir = resolvePackDirOrNull(cwd, namespace, options.pack);
    sink = (packDir && isRepo(packDir)) ? 'git' : 'file';
  }

  if (sink === 'git') {
    // The git sink IS sync-area: render into the real repo, bump, commit, print push, move.
    return syncArea(areaRef, options);
  }
  if (sink === 'file') {
    // The file sink snapshots at the current version -- it ignores --minor/--major (git-sink only).
    return fileSink(areaRef, {
      cwd, gameRoot, namespace, area,
      force: options.force, keepSidecars: options.keepSidecars,
      out: options.out, name: options.name, pack: options.pack,
    });
  }
  throw new Error(`Unknown sink '${sink}'. Use 'file' or 'git'.`);
}

module.exports = { harvest };
