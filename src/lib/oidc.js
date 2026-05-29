'use strict';

const fetch = require('node-fetch');

const AUDIENCE = 'https://registry.tapestryengine.com';

function detectCI() {
  return !!(process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN);
}

async function fetchGitHubIdToken(audience = AUDIENCE) {
  const base = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const reqToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  const url = `${base}&audience=${encodeURIComponent(audience)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${reqToken}` } });
  if (!res.ok) {
    throw new Error(`failed to fetch GitHub OIDC id-token (HTTP ${res.status})`);
  }
  const { value } = await res.json();
  if (!value) {
    throw new Error('GitHub OIDC response had no token value');
  }
  return value;
}

module.exports = { detectCI, fetchGitHubIdToken, AUDIENCE };
