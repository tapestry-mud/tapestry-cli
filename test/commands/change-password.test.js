'use strict';

jest.mock('node-fetch');
jest.mock('../../src/lib/auth');
jest.mock('../../src/util/prompt');

const fetch = require('node-fetch');
const { requireToken } = require('../../src/lib/auth');
const { createInterface, askPassword } = require('../../src/util/prompt');
const { changePassword } = require('../../src/commands/change-password');

beforeEach(() => {
  jest.clearAllMocks();
  requireToken.mockReturnValue('test-token');
  createInterface.mockReturnValue({ close: jest.fn() });
});

it('sends correct body and prints success', async () => {
  askPassword
    .mockResolvedValueOnce('oldpass')
    .mockResolvedValueOnce('newpass')
    .mockResolvedValueOnce('newpass');
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ message: 'Password updated' }),
  });
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  await changePassword();

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/v1/auth/change-password'),
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      body: JSON.stringify({ currentPassword: 'oldpass', newPassword: 'newpass' }),
    })
  );
  expect(consoleSpy).toHaveBeenCalledWith('Password changed.');
  consoleSpy.mockRestore();
});

it('throws when passwords do not match without calling fetch', async () => {
  askPassword
    .mockResolvedValueOnce('oldpass')
    .mockResolvedValueOnce('newpass1')
    .mockResolvedValueOnce('newpass2');

  await expect(changePassword()).rejects.toThrow('Passwords do not match');
  expect(fetch).not.toHaveBeenCalled();
});

it('throws on 401 from registry', async () => {
  askPassword
    .mockResolvedValueOnce('oldpass')
    .mockResolvedValueOnce('newpass')
    .mockResolvedValueOnce('newpass');
  fetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: 'current password is incorrect' }),
  });

  await expect(changePassword()).rejects.toThrow('current password is incorrect');
});

it('throws generic message when registry error body has no error field', async () => {
  askPassword
    .mockResolvedValueOnce('oldpass')
    .mockResolvedValueOnce('newpass')
    .mockResolvedValueOnce('newpass');
  fetch.mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({}),
  });

  await expect(changePassword()).rejects.toThrow('Change password failed (500)');
});

it('throws if not logged in without calling fetch', async () => {
  requireToken.mockImplementation(() => {
    throw new Error('Not logged in. Run: tapestry login');
  });

  await expect(changePassword()).rejects.toThrow('Not logged in');
  expect(fetch).not.toHaveBeenCalled();
});

it('uses custom registryUrl when provided', async () => {
  askPassword
    .mockResolvedValueOnce('oldpass')
    .mockResolvedValueOnce('newpass')
    .mockResolvedValueOnce('newpass');
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ message: 'Password updated' }),
  });

  await changePassword({ registryUrl: 'http://localhost:3002' });

  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:3002/v1/auth/change-password',
    expect.anything()
  );
});
