'use strict';

const fs = require('fs');
const { saveSession, clearSession, loadAccess, requireAccess, decodeExp, decodeScopes, RC_PATH } = require('../../src/lib/auth');

// A JWT whose payload is {exp}. Signature is irrelevant to the CLI (it never verifies).
function fakeJwt(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

afterEach(() => jest.restoreAllMocks());

describe('decodeExp', () => {
  it('reads the exp claim from a JWT', () => {
    expect(decodeExp(fakeJwt({ sub: 'x', exp: 1234 }))).toBe(1234);
  });
  it('returns null on a malformed token', () => {
    expect(decodeExp('garbage')).toBeNull();
  });
});

describe('decodeScopes', () => {
  it('reads the scopes claim from a JWT', () => {
    expect(decodeScopes(fakeJwt({ sub: 'mallek', scopes: ['mallek'] }))).toEqual(['mallek']);
  });
  it('returns null on a malformed token', () => {
    expect(decodeScopes('garbage')).toBeNull();
  });
  it('returns null when scopes is missing or not an array', () => {
    expect(decodeScopes(fakeJwt({ sub: 'mallek' }))).toBeNull();
    expect(decodeScopes(fakeJwt({ sub: 'mallek', scopes: 'mallek' }))).toBeNull();
  });
});

describe('saveSession', () => {
  it('writes the 4-field session to RC_PATH at mode 0600', () => {
    const spy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    saveSession({ registry: 'https://r', access: 'a', access_exp: 99, refresh: 'r' });
    expect(spy).toHaveBeenCalledWith(
      RC_PATH,
      expect.stringContaining('refresh: r'),
      { mode: 0o600 }
    );
  });
});

describe('loadAccess', () => {
  it('returns null when rc is absent', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(await loadAccess()).toBeNull();
  });

  it('returns the access token when not near expiry', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(
      `registry: https://r\naccess: good-access\naccess_exp: ${future}\nrefresh: rr\n`
    );
    expect(await loadAccess()).toBe('good-access');
  });

  it('returns null for a legacy token-only rc (forces re-login)', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('token: legacy\n');
    expect(await loadAccess()).toBeNull();
  });
});

describe('requireAccess', () => {
  it('throws when there is no session', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    await expect(requireAccess()).rejects.toThrow('Not logged in. Run: tapestry login');
  });
});
