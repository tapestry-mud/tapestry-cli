'use strict';

jest.mock('node-fetch');
jest.mock('../../src/lib/auth');

const fetch = require('node-fetch');
const auth = require('../../src/lib/auth');
const { logout } = require('../../src/commands/logout');

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => jest.restoreAllMocks());

it('posts the refresh token then clears the session', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  auth.readSession.mockReturnValue({ registry: 'https://r', refresh: 'rr' });
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: 'logged out' }) });
  await logout();
  expect(fetch).toHaveBeenCalledWith('https://r/v1/auth/logout', expect.objectContaining({ method: 'POST' }));
  expect(auth.clearSession).toHaveBeenCalled();
  consoleSpy.mockRestore();
});

it('clears the session even if not logged in', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  auth.readSession.mockReturnValue(null);
  await logout();
  expect(auth.clearSession).toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  consoleSpy.mockRestore();
});
