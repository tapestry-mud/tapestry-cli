'use strict';

jest.mock('child_process', () => ({ spawnSync: jest.fn(() => ({ status: 0 })) }));
const { spawnSync } = require('child_process');
const { isRepo, commitAll } = require('../../src/lib/git');

beforeEach(() => { spawnSync.mockClear(); spawnSync.mockReturnValue({ status: 0 }); });

describe('isRepo', () => {
  it('returns true when git rev-parse succeeds', () => {
    expect(isRepo('/some/dir')).toBe(true);
    expect(spawnSync).toHaveBeenCalledWith(
      'git', ['-C', '/some/dir', 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
  });

  it('returns false when git rev-parse fails', () => {
    spawnSync.mockReturnValue({ status: 128 });
    expect(isRepo('/some/dir')).toBe(false);
  });
});

describe('commitAll', () => {
  it('runs git add -A then git commit -m', () => {
    commitAll('/d', 'my message');
    expect(spawnSync).toHaveBeenNthCalledWith(1, 'git', ['-C', '/d', 'add', '-A'], { stdio: 'ignore' });
    expect(spawnSync).toHaveBeenNthCalledWith(2, 'git', ['-C', '/d', 'commit', '-m', 'my message'], { stdio: 'ignore' });
  });

  it('throws when git add fails', () => {
    spawnSync.mockReturnValueOnce({ status: 1 });
    expect(() => commitAll('/d', 'm')).toThrow(/git add failed/);
  });

  it('throws when git commit fails', () => {
    spawnSync.mockReturnValueOnce({ status: 0 }).mockReturnValueOnce({ status: 1 });
    expect(() => commitAll('/d', 'm')).toThrow(/git commit failed/);
  });
});
