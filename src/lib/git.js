'use strict';

const { spawnSync } = require('child_process');

function isRepo(dir) {
  const res = spawnSync('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
  return res.status === 0;
}

// Stage everything in dir and commit. Throws on failure.
function commitAll(dir, message) {
  const add = spawnSync('git', ['-C', dir, 'add', '-A'], { stdio: 'ignore' });
  if (add.status !== 0) {
    throw new Error(`git add failed in ${dir}`);
  }
  const commit = spawnSync('git', ['-C', dir, 'commit', '-m', message], { stdio: 'ignore' });
  if (commit.status !== 0) {
    throw new Error(`git commit failed in ${dir}`);
  }
}

module.exports = { isRepo, commitAll };
