'use strict';

jest.mock('node-fetch');
jest.mock('../../src/lib/auth');

const fetch = require('node-fetch');
const auth = require('../../src/lib/auth');
const { login } = require('../../src/commands/login');

beforeEach(() => {
  jest.clearAllMocks();
});

function fakeAccess() {
  return `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: 9999999999 })).toString('base64url')}.s`;
}

it('logs in with email+password and saves a session', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const access = fakeAccess();
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ access_token: access, refresh_token: 'rr' }) });

  await login({ email: 'a@x.com', password: 'pw' }, { registryUrl: 'https://r' });

  expect(fetch).toHaveBeenCalledWith('https://r/v1/auth/login', expect.objectContaining({ method: 'POST' }));
  expect(auth.saveSession).toHaveBeenCalledWith(expect.objectContaining({ registry: 'https://r', access, refresh: 'rr' }));
  expect(consoleSpy).toHaveBeenCalledWith('Logged in.');
  consoleSpy.mockRestore();
});

it('throws on invalid credentials', async () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: 'invalid credentials' }),
  });

  await expect(
    login({ email: 'bad@example.com', password: 'wrong' })
  ).rejects.toThrow('invalid credentials');
  expect(auth.saveSession).not.toHaveBeenCalled();
});

it('throws generic message when error body has no error field', async () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({}),
  });

  await expect(
    login({ email: 'user@example.com', password: 'pass' })
  ).rejects.toThrow('Login failed (500)');
});

it('uses custom registryUrl when provided', async () => {
  fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ access_token: fakeAccess(), refresh_token: 'rr' }),
  });

  await login(
    { email: 'a@b.com', password: 'x' },
    { registryUrl: 'http://localhost:3002' }
  );

  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:3002/v1/auth/login',
    expect.anything()
  );
});
