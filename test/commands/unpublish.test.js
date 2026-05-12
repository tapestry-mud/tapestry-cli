'use strict';

jest.mock('node-fetch');
jest.mock('../../src/lib/auth');
jest.mock('../../src/util/prompt');

const fetch = require('node-fetch');
const { requireToken } = require('../../src/lib/auth');
const { createInterface, ask } = require('../../src/util/prompt');
const { unpublish } = require('../../src/commands/unpublish');

beforeEach(() => {
  jest.clearAllMocks();
  requireToken.mockReturnValue('test-token');
  createInterface.mockReturnValue({ close: jest.fn() });
});

describe('single-version mode (@scope/name@version)', () => {
  it('sends DELETE to versioned URL after y confirmation', async () => {
    ask.mockResolvedValue('y');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Unpublished @scope/mypkg@1.0.0' }),
    });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await unpublish('@scope/mypkg@1.0.0');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/packages/@scope/mypkg/1.0.0'),
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
    expect(consoleSpy).toHaveBeenCalledWith('Unpublished @scope/mypkg@1.0.0');
    consoleSpy.mockRestore();
  });

  it('also accepts uppercase Y', async () => {
    ask.mockResolvedValue('Y');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Unpublished @scope/mypkg@1.0.0' }),
    });
    await unpublish('@scope/mypkg@1.0.0');
    expect(fetch).toHaveBeenCalled();
  });

  it('cancels without calling fetch when user answers N', async () => {
    ask.mockResolvedValue('N');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await unpublish('@scope/mypkg@1.0.0');

    expect(fetch).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Cancelled.');
    consoleSpy.mockRestore();
  });

  it('cancels when user presses enter (empty answer)', async () => {
    ask.mockResolvedValue('');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await unpublish('@scope/mypkg@1.0.0');

    expect(fetch).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('all-versions mode (@scope/name)', () => {
  it('sends DELETE to package URL after name confirmation', async () => {
    ask.mockResolvedValue('@scope/mypkg');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Unpublished all versions of @scope/mypkg' }),
    });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await unpublish('@scope/mypkg');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/packages/@scope/mypkg'),
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(consoleSpy).toHaveBeenCalledWith('Unpublished all versions of @scope/mypkg');
    consoleSpy.mockRestore();
  });

  it('cancels without calling fetch when name does not match', async () => {
    ask.mockResolvedValue('@scope/wrongname');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await unpublish('@scope/mypkg');

    expect(fetch).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Cancelled.');
    consoleSpy.mockRestore();
  });
});

describe('--force flag', () => {
  it('appends ?force=true to single-version URL', async () => {
    ask.mockResolvedValue('y');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Unpublished @scope/mypkg@1.0.0' }),
    });

    await unpublish('@scope/mypkg@1.0.0', { force: true });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('?force=true'),
      expect.anything()
    );
  });

  it('appends ?force=true to all-versions URL', async () => {
    ask.mockResolvedValue('@scope/mypkg');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Unpublished all versions of @scope/mypkg' }),
    });

    await unpublish('@scope/mypkg', { force: true });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('?force=true'),
      expect.anything()
    );
  });
});

describe('error handling', () => {
  it('throws on 403', async () => {
    ask.mockResolvedValue('y');
    fetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'not the package owner' }),
    });

    await expect(unpublish('@scope/mypkg@1.0.0')).rejects.toThrow('not the package owner');
  });

  it('throws generic message when error body has no error field', async () => {
    ask.mockResolvedValue('y');
    fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(unpublish('@scope/mypkg@1.0.0')).rejects.toThrow('Unpublish failed (500)');
  });

  it('throws if not logged in without calling fetch', async () => {
    requireToken.mockImplementation(() => {
      throw new Error('Not logged in. Run: tapestry login');
    });

    await expect(unpublish('@scope/mypkg@1.0.0')).rejects.toThrow('Not logged in');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws on invalid package name format', async () => {
    await expect(unpublish('notascoped/package')).rejects.toThrow('Invalid package name');
    expect(fetch).not.toHaveBeenCalled();
  });
});
