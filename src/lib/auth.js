'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const fetch = require('node-fetch');

const RC_PATH = path.join(os.homedir(), '.tapestryrc');
const DEFAULT_REGISTRY = process.env.TAPESTRY_REGISTRY || 'https://registry.tapestryengine.com';
const REFRESH_SKEW_SECONDS = 60; // refresh slightly before actual expiry

function readSession() {
  if (!fs.existsSync(RC_PATH)) {
    return null;
  }
  try {
    return yaml.load(fs.readFileSync(RC_PATH, 'utf8')) || null;
  } catch {
    return null;
  }
}

function saveSession({ registry, access, access_exp, refresh }) {
  fs.writeFileSync(
    RC_PATH,
    yaml.dump({ registry, access, access_exp, refresh }, { lineWidth: -1 }),
    { mode: 0o600 }
  );
}

function clearSession() {
  if (fs.existsSync(RC_PATH)) {
    fs.unlinkSync(RC_PATH);
  }
}

function decodeExp(jwtString) {
  try {
    const payload = JSON.parse(Buffer.from(jwtString.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

async function loadAccess() {
  const s = readSession();
  if (!s || !s.access || !s.refresh) {
    return null; // absent, or legacy token-only rc
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof s.access_exp === 'number' && now < s.access_exp - REFRESH_SKEW_SECONDS) {
    return s.access;
  }
  // Access expired (or near it): silently refresh.
  const registry = s.registry || DEFAULT_REGISTRY;
  const res = await fetch(`${registry}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: s.refresh }),
  });
  if (!res.ok) {
    clearSession();
    return null;
  }
  const { access_token, refresh_token } = await res.json();
  saveSession({ registry, access: access_token, access_exp: decodeExp(access_token), refresh: refresh_token });
  return access_token;
}

async function requireAccess() {
  const access = await loadAccess();
  if (!access) {
    throw new Error('Not logged in. Run: tapestry login');
  }
  return access;
}

module.exports = {
  RC_PATH, DEFAULT_REGISTRY,
  readSession, saveSession, clearSession, decodeExp,
  loadAccess, requireAccess,
};
