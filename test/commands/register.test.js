'use strict';

jest.mock('node-fetch');
jest.mock('../../src/lib/auth');

const fetch = require('node-fetch');
const auth = require('../../src/lib/auth');
const { register } = require('../../src/commands/register');

beforeEach(() => {
  jest.clearAllMocks();
});

function fakeAccess() {
  return `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: 9999999999 })).toString('base64url')}.s`;
}

it('posts registration and saves a session on success', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const access = fakeAccess();

  fetch.mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ access_token: access, refresh_token: 'rr' }),
  });

  await register({ handle: 'mallek', email: 'me@example.com', password: 'pass' }, { registryUrl: 'https://r' });

  expect(fetch).toHaveBeenCalledWith(
    'https://r/v1/auth/register',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ handle: 'mallek', email: 'me@example.com', password: 'pass' }),
    })
  );
  expect(auth.saveSession).toHaveBeenCalledWith(expect.objectContaining({ registry: 'https://r', access, refresh: 'rr' }));
  expect(consoleSpy).toHaveBeenCalledWith('Registered as mallek. Logged in.');

  consoleSpy.mockRestore();
});

it('throws on conflict (handle taken)', async () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ error: 'handle or email already taken' }),
  });

  await expect(
    register({ handle: 'taken', email: 'x@x.com', password: 'pw' })
  ).rejects.toThrow('handle or email already taken');
  expect(auth.saveSession).not.toHaveBeenCalled();
});

it('throws generic message when server returns no error field', async () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({}),
  });

  await expect(
    register({ handle: 'h', email: 'e@e.com', password: 'p' })
  ).rejects.toThrow('Registration failed (500)');
});

it('uses custom registryUrl when provided', async () => {
  fetch.mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ access_token: fakeAccess(), refresh_token: 'rr' }),
  });

  await register(
    { handle: 'h', email: 'a@b.com', password: 'x' },
    { registryUrl: 'http://localhost:3002' }
  );

  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:3002/v1/auth/register',
    expect.anything()
  );
});
