'use strict';

jest.mock('node-fetch');
const fetch = require('node-fetch');
const { detectCI, fetchGitHubIdToken } = require('../../src/lib/oidc');

const OLD = process.env;
beforeEach(() => { process.env = { ...OLD }; jest.restoreAllMocks(); });
afterAll(() => { process.env = OLD; });

describe('detectCI', () => {
  it('true only when both Actions OIDC vars are present', () => {
    process.env.ACTIONS_ID_TOKEN_REQUEST_URL = 'https://t/req';
    process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'rtoken';
    expect(detectCI()).toBe(true);
  });
  it('false when missing', () => {
    delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    expect(detectCI()).toBe(false);
  });
});

describe('fetchGitHubIdToken', () => {
  it('GETs the request url with audience and bearer, returns .value', async () => {
    process.env.ACTIONS_ID_TOKEN_REQUEST_URL = 'https://t/req';
    process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'rtoken';
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ value: 'id-token-123' }) });
    const tok = await fetchGitHubIdToken('https://registry.tapestryengine.com');
    expect(tok).toBe('id-token-123');
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('https://t/req&audience=https%3A%2F%2Fregistry.tapestryengine.com');
    expect(opts.headers.Authorization).toBe('Bearer rtoken');
  });
});
