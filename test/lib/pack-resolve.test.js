'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeYaml } = require('../../src/util/yaml');

// Mock only readSession; keep the real decodeScopes (pack-resolve.js destructures both from
// this module, so a bare { readSession } mock would leave decodeScopes undefined and throw).
jest.mock('../../src/lib/auth', () => ({
  ...jest.requireActual('../../src/lib/auth'),
  readSession: jest.fn(),
}));

const { readSession } = require('../../src/lib/auth');
const {
  parseAreaRef, packNamespace, detectPackDir, resolvePackDirOrNull,
  isOwnedNamespace, resolveOperatorScope,
} = require('../../src/lib/pack-resolve');

// A JWT whose payload is the given object. Signature is irrelevant - the CLI never verifies
// (same fixture shape as test/lib/auth.test.js's fakeJwt).
function fakeJwt(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-resolve-')); });
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  readSession.mockReset();
});

function seedLinkedPack() {
  const packDir = path.join(tmp, 'packs', '@legends', 'forgotten');
  fs.mkdirSync(packDir, { recursive: true });
  writeYaml(path.join(packDir, 'pack.yaml'), { name: '@legends/forgotten', version: '0.1.0' });
  writeYaml(path.join(tmp, 'tapestry-links.yaml'), { version: 1, links: { '@legends/forgotten': packDir } });
  return packDir;
}

describe('parseAreaRef', () => {
  it('splits namespace:area', () => {
    expect(parseAreaRef('legends-forgotten:lf-hollow')).toEqual({ namespace: 'legends-forgotten', area: 'lf-hollow' });
  });
  it('throws on a missing colon', () => {
    expect(() => parseAreaRef('lf-hollow')).toThrow(/namespace:area-id/i);
  });
});

describe('packNamespace', () => {
  it('flattens a scoped name', () => {
    expect(packNamespace('@legends/forgotten')).toBe('legends-forgotten');
  });
});

describe('resolvePackDirOrNull', () => {
  it('returns the linked pack matching the namespace', () => {
    const packDir = seedLinkedPack();
    expect(resolvePackDirOrNull(tmp, 'legends-forgotten')).toBe(packDir);
  });
  it('returns null when no pack matches (hobbyist case)', () => {
    expect(resolvePackDirOrNull(tmp, 'nobody-home')).toBeNull();
  });
});

describe('detectPackDir', () => {
  it('throws when no pack matches', () => {
    expect(() => detectPackDir(tmp, 'nobody-home')).toThrow(/could not auto-detect/i);
  });
});

describe('isOwnedNamespace', () => {
  it('owns an exact match', () => {
    expect(isOwnedNamespace('mallek', 'mallek')).toBe(true);
  });

  it('owns a namespace prefixed with scope + dash (SA5 prefix rule)', () => {
    expect(isOwnedNamespace('mallek-core-fork', 'mallek')).toBe(true);
  });

  it('owns a hyphenated scope prefix match (SA5: fixes the first-dash regression)', () => {
    expect(isOwnedNamespace('my-org-core', 'my-org')).toBe(true);
  });

  it('owns the documented lossy-prefix residual (SA5: accepted, not a defect)', () => {
    // packNamespace flattens both @my/org-core and @my-org/core to 'my-org-core', so scope
    // 'my' also reads as owning it. Documented residual, not built around in this slice.
    expect(isOwnedNamespace('my-org-core', 'my')).toBe(true);
  });

  it('does not own an unrelated namespace', () => {
    expect(isOwnedNamespace('tapestry-core', 'mallek')).toBe(false);
    expect(isOwnedNamespace('my-org-core', 'mallek')).toBe(false);
  });

  it('does not own a namespace that merely shares a substring, not a dash-bounded prefix', () => {
    expect(isOwnedNamespace('mallekworld-core', 'mallek')).toBe(false);
  });
});

describe('resolveOperatorScope', () => {
  it('returns null when there is no session', () => {
    readSession.mockReturnValue(null);
    expect(resolveOperatorScope()).toBeNull();
  });

  it('returns null when the session has no access token', () => {
    readSession.mockReturnValue({ refresh: 'r' });
    expect(resolveOperatorScope()).toBeNull();
  });

  it('returns the first scopes claim from the access token', () => {
    readSession.mockReturnValue({ access: fakeJwt({ sub: 'mallek', scopes: ['mallek'] }) });
    expect(resolveOperatorScope()).toBe('mallek');
  });

  it('returns null when the access token has no scopes claim', () => {
    readSession.mockReturnValue({ access: fakeJwt({ sub: 'mallek' }) });
    expect(resolveOperatorScope()).toBeNull();
  });
});
