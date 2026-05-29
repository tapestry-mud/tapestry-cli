'use strict';

const fetch = require('node-fetch');

const DEFAULT_REGISTRY = process.env.TAPESTRY_REGISTRY || 'https://registry.tapestryengine.com';

function validatePackageName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Package name must be a non-empty string');
  }
  if (!/^@[a-z0-9-]+\/[a-z0-9-]+/.test(name)) {
    throw new Error(`Invalid package name: ${name}. Expected @scope/name format`);
  }
  if (name.includes('..') || name.includes('//')) {
    throw new Error(`Invalid package name: ${name}. Path traversal not allowed`);
  }
}

async function throwIfError(res, context) {
  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after');
    const hint = retryAfter ? ` Try again in ${Math.ceil(Number(retryAfter) / 60)} min.` : '';
    throw new Error(`Rate limit exceeded.${hint}`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${context} (${res.status})`);
  }
}

async function fetchPackageMetadata(name, registryUrl = DEFAULT_REGISTRY, token = null) {
  validatePackageName(name);
  const url = `${registryUrl}/v1/packages/${name}`;
  const headers = {};
  if (token) { headers['Authorization'] = `Bearer ${token}`; }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Package ${name} not found in registry`);
    }
    const body = await res.text();
    throw new Error(`Registry error ${res.status}: ${body}`);
  }
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`Invalid JSON response from registry for ${name}`);
  }
}

async function fetchTarball(url, token = null) {
  const headers = {};
  if (token) { headers['Authorization'] = `Bearer ${token}`; }
  const res = await fetch(url, { headers });
  if (res.status === 401) {
    throw new Error('pack is private - run tapestry login first');
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tarball download failed: ${res.status}: ${body}`);
  }
  return res.buffer();
}

async function fetchPreset(name, registryUrl = DEFAULT_REGISTRY) {
  const url = `${registryUrl.replace(/\/$/, '')}/v1/presets/${name}`;
  const res = await fetch(url);
  await throwIfError(res, `Failed to fetch preset '${name}'`);
  return res.json();
}

async function fetchPresetList(registryUrl = DEFAULT_REGISTRY) {
  const url = `${registryUrl.replace(/\/$/, '')}/v1/presets`;
  const res = await fetch(url);
  if (res.status === 404) {
    return null;
  }
  await throwIfError(res, 'Failed to fetch preset list');
  return res.json();
}

async function patchDistTag(packName, tag, version, token, registryUrl = DEFAULT_REGISTRY) {
  validatePackageName(packName);
  const url = `${registryUrl.replace(/\/$/, '')}/v1/packages/${packName}/dist-tags/${tag}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ version }),
  });
  await throwIfError(res, `Failed to set dist-tag ${tag} on ${packName}`);
  return res.json();
}

async function listDistTags(packName, registryUrl = DEFAULT_REGISTRY) {
  validatePackageName(packName);
  const url = `${registryUrl.replace(/\/$/, '')}/v1/packages/${packName}/dist-tags`;
  const res = await fetch(url);
  await throwIfError(res, `Failed to fetch dist-tags for ${packName}`);
  return res.json();
}

async function patchPreset(name, payload, token, registryUrl = DEFAULT_REGISTRY) {
  const url = `${registryUrl.replace(/\/$/, '')}/v1/admin/presets/${name}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  await throwIfError(res, `Failed to update preset '${name}'`);
  return res.json();
}

async function deletePreset(name, token, registryUrl = DEFAULT_REGISTRY) {
  const url = `${registryUrl.replace(/\/$/, '')}/v1/admin/presets/${name}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await throwIfError(res, `Failed to delete preset '${name}'`);
  return res.json();
}

async function postLogout(refreshToken, registryUrl = DEFAULT_REGISTRY) {
  const res = await fetch(`${registryUrl.replace(/\/$/, '')}/v1/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  await throwIfError(res, 'Logout failed');
  return res.json();
}

module.exports = {
  fetchPackageMetadata, fetchTarball, throwIfError, DEFAULT_REGISTRY,
  fetchPreset, fetchPresetList, patchDistTag, listDistTags, patchPreset, deletePreset,
  postLogout,
};
