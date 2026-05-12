'use strict';

const fetch = require('node-fetch');
const { saveToken } = require('../lib/auth');
const { DEFAULT_REGISTRY } = require('../lib/registry-client');
const { createInterface, ask, askPassword } = require('../util/prompt');

async function promptCredentials() {
  const rl = createInterface();
  try {
    const email = await ask(rl, 'Email: ');
    const password = await askPassword(rl, 'Password: ');
    return { email, password };
  } finally {
    rl.close();
  }
}

async function login({ email, password } = {}, { registryUrl = DEFAULT_REGISTRY } = {}) {
  if (!email || !password) {
    ({ email, password } = await promptCredentials());
  }

  const res = await fetch(`${registryUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Login failed (${res.status})`);
  }

  const { token } = await res.json();
  saveToken(token);
  console.log('Logged in.');
}

module.exports = { login };
