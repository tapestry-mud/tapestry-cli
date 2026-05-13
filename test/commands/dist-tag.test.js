'use strict';

jest.mock('../../src/lib/registry-client');
jest.mock('../../src/lib/auth');

const { patchDistTag, listDistTags } = require('../../src/lib/registry-client');
const { requireToken } = require('../../src/lib/auth');
const { distTagSet, distTagList } = require('../../src/commands/dist-tag');

beforeEach(() => {
  jest.clearAllMocks();
  requireToken.mockReturnValue('test-token');
});

describe('distTagSet', () => {
  test('calls patchDistTag with correct args', async () => {
    patchDistTag.mockResolvedValue({ tag: 'stable', version: '1.0.0' });
    await distTagSet('@tapestry/core', 'stable', '1.0.0');
    expect(patchDistTag).toHaveBeenCalledWith(
      '@tapestry/core', 'stable', '1.0.0', 'test-token',
      expect.any(String)
    );
  });

  test('requires login', async () => {
    requireToken.mockImplementation(() => { throw new Error('Not logged in. Run: tapestry login'); });
    await expect(distTagSet('@tapestry/core', 'stable', '1.0.0'))
      .rejects.toThrow('Not logged in');
  });

  test('logs success after setting tag', async () => {
    patchDistTag.mockResolvedValue({ tag: 'stable', version: '1.0.0' });
    const log = jest.spyOn(console, 'log').mockImplementation();
    await distTagSet('@tapestry/core', 'stable', '1.0.0');
    expect(log.mock.calls.flat().join(' ')).toMatch(/@tapestry\/core.*stable.*1\.0\.0/);
    log.mockRestore();
  });
});

describe('distTagList', () => {
  test('calls listDistTags with pack name', async () => {
    listDistTags.mockResolvedValue({ latest: '1.0.0', stable: '0.9.0' });
    await distTagList('@tapestry/core');
    expect(listDistTags).toHaveBeenCalledWith('@tapestry/core', expect.any(String));
  });

  test('prints each tag on its own line', async () => {
    listDistTags.mockResolvedValue({ latest: '1.0.0', stable: '0.9.0' });
    const log = jest.spyOn(console, 'log').mockImplementation();
    await distTagList('@tapestry/core');
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('latest');
    expect(output).toContain('1.0.0');
    expect(output).toContain('stable');
    expect(output).toContain('0.9.0');
    log.mockRestore();
  });

  test('prints message when no tags set', async () => {
    listDistTags.mockResolvedValue({});
    const log = jest.spyOn(console, 'log').mockImplementation();
    await distTagList('@tapestry/core');
    expect(log.mock.calls.flat().join(' ')).toMatch(/no tags/i);
    log.mockRestore();
  });
});
