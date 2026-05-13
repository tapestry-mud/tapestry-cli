'use strict';

const { fetchPackageMetadata, fetchTarball, DEFAULT_REGISTRY } = require('../../src/lib/registry-client');

jest.mock('node-fetch');
const fetch = require('node-fetch');

describe('registry-client', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  describe('DEFAULT_REGISTRY', () => {
    it('uses env var when set', () => {
      const orig = process.env.TAPESTRY_REGISTRY;
      process.env.TAPESTRY_REGISTRY = 'http://myregistry.test';
      jest.resetModules();
      const { DEFAULT_REGISTRY: dr } = require('../../src/lib/registry-client');
      expect(dr).toBe('http://myregistry.test');
      if (orig === undefined) {
        delete process.env.TAPESTRY_REGISTRY;
      } else {
        process.env.TAPESTRY_REGISTRY = orig;
      }
    });
  });

  describe('fetchPackageMetadata', () => {
    it('fetches package metadata from correct URL', async () => {
      const meta = { name: '@tapestry/core', versions: [] };
      fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(meta) });

      const result = await fetchPackageMetadata('@tapestry/core', 'http://localhost:3002');

      expect(fetch).toHaveBeenCalledWith('http://localhost:3002/v1/packages/@tapestry/core', expect.any(Object));
      expect(result).toEqual(meta);
    });

    it('throws on 404', async () => {
      fetch.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('not found') });

      await expect(fetchPackageMetadata('@tapestry/missing', 'http://localhost:3002'))
        .rejects.toThrow('Package @tapestry/missing not found in registry');
    });

    it('throws on non-404 error', async () => {
      fetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('oops') });

      await expect(fetchPackageMetadata('@tapestry/core', 'http://localhost:3002'))
        .rejects.toThrow('Registry error 500');
    });
  });

  describe('fetchTarball', () => {
    it('returns buffer on success', async () => {
      const buf = Buffer.from('fake tarball');
      fetch.mockResolvedValue({
        ok: true,
        buffer: () => Promise.resolve(buf),
      });

      const result = await fetchTarball('http://localhost:3002/v1/packages/@tapestry/core/1.0.0.tgz');

      expect(result).toEqual(buf);
    });

    it('throws on download failure', async () => {
      fetch.mockResolvedValue({ ok: false, status: 403, text: () => Promise.resolve('forbidden') });

      await expect(fetchTarball('http://localhost:3002/bad.tgz'))
        .rejects.toThrow('Tarball download failed: 403');
    });
  });

  describe('fetchPackageMetadata input validation', () => {
    it('throws on invalid package name format', async () => {
      await expect(fetchPackageMetadata('not-scoped', 'http://localhost:3002'))
        .rejects.toThrow('Invalid package name');
    });

    it('throws on path traversal attempt', async () => {
      await expect(fetchPackageMetadata('@scope/../../../etc/passwd', 'http://localhost:3002'))
        .rejects.toThrow('Invalid package name');
    });

    it('throws on empty string', async () => {
      await expect(fetchPackageMetadata('', 'http://localhost:3002'))
        .rejects.toThrow('Package name must be a non-empty string');
    });
  });
});

describe('fetchPackageMetadata with auth token', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('forwards Authorization header when token provided', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ name: '@tapestry/core', versions: [] }) });
    await fetchPackageMetadata('@tapestry/core', 'http://localhost:3002', 'my-token');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3002/v1/packages/@tapestry/core',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer my-token' }) })
    );
  });

  it('sends no Authorization header when token is null', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ name: '@tapestry/core', versions: [] }) });
    await fetchPackageMetadata('@tapestry/core', 'http://localhost:3002', null);
    const callArgs = fetch.mock.calls[0];
    const headers = callArgs[1]?.headers || {};
    expect(headers).not.toHaveProperty('Authorization');
  });
});

describe('fetchTarball with auth token', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('forwards Authorization header when token provided', async () => {
    fetch.mockResolvedValue({ ok: true, buffer: () => Promise.resolve(Buffer.from('data')) });
    await fetchTarball('http://localhost:3002/v1/packages/@s/p/1.0.0.tgz', 'my-token');
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer my-token' }) })
    );
  });

  it('throws private pack error on 401', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('Unauthorized') });
    await expect(fetchTarball('http://localhost:3002/v1/packages/@s/p/1.0.0.tgz'))
      .rejects.toThrow('pack is private - run tapestry login first');
  });
});

const { fetchPreset, patchDistTag, listDistTags, patchPreset } = require('../../src/lib/registry-client');

describe('fetchPreset', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('fetches preset from correct URL', async () => {
    const preset = { name: 'starter', version: '0.0.1', engine_channel: 'stable', packs: { '@tapestry/core': '0.0.2' } };
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(preset) });
    const result = await fetchPreset('starter', 'http://localhost:3002');
    expect(fetch).toHaveBeenCalledWith('http://localhost:3002/v1/presets/starter');
    expect(result).toEqual(preset);
  });

  it('throws on 404', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({ error: 'not found' }) });
    await expect(fetchPreset('nonexistent', 'http://localhost:3002'))
      .rejects.toThrow();
  });
});

describe('patchDistTag', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('sends PATCH to correct URL with auth', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ tag: 'stable', version: '1.0.0' }) });
    await patchDistTag('@tapestry/core', 'stable', '1.0.0', 'ci-token', 'http://localhost:3002');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3002/v1/packages/@tapestry/core/dist-tags/stable',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer ci-token' }),
      })
    );
  });
});

describe('listDistTags', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('fetches dist-tags for a package', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ latest: '1.0.0', stable: '0.9.0' }) });
    const result = await listDistTags('@tapestry/core', 'http://localhost:3002');
    expect(fetch).toHaveBeenCalledWith('http://localhost:3002/v1/packages/@tapestry/core/dist-tags');
    expect(result.latest).toBe('1.0.0');
  });
});

describe('patchPreset', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('sends PATCH to admin preset endpoint', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ name: 'starter' }) });
    await patchPreset('starter', { version: '0.0.2', engine_channel: 'stable', packs: {} }, 'admin-token', 'http://localhost:3002');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3002/v1/admin/presets/starter',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      })
    );
  });
});
