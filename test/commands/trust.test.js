'use strict';

jest.mock('node-fetch');
jest.mock('../../src/lib/auth');

const fetch = require('node-fetch');
const auth = require('../../src/lib/auth');
const { trustAdd, trustList, trustRm } = require('../../src/commands/trust');

beforeEach(() => {
  jest.clearAllMocks();
  auth.requireAccess.mockResolvedValue('acc-token');
  auth.readSession.mockReturnValue({ registry: 'https://r' });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('trustAdd POSTs a binding with the access token', async () => {
  fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 1, scope: 'me', repo: 'me/packs' }) });
  await trustAdd('me', 'me/packs', {});
  expect(fetch).toHaveBeenCalledWith(
    'https://r/v1/trusted-publishers',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer acc-token' }),
    })
  );
});

it('trustList GETs bindings', async () => {
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ([{ id: 1, scope: 'me', repo: 'me/p' }]) });
  await trustList(undefined);
  expect(fetch).toHaveBeenCalledWith(
    'https://r/v1/trusted-publishers',
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer acc-token' }) })
  );
});

it('trustRm DELETEs by id', async () => {
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: 'binding deleted' }) });
  await trustRm('7');
  expect(fetch).toHaveBeenCalledWith(
    'https://r/v1/trusted-publishers/7',
    expect.objectContaining({ method: 'DELETE' })
  );
});
