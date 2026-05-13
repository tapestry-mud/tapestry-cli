'use strict';

const fetch = require('node-fetch');
const { saveToken } = require('../lib/auth');
const { DEFAULT_REGISTRY, throwIfError } = require('../lib/registry-client');
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

async function login({ email, password } = {}, { registryUrl = DEFAULT_REGISTRY, token = null } = {}) {
  if (token) {
    saveToken(token);
    console.log('Token saved.');
    return;
  }
  if (!email || !password) {
    ({ email, password } = await promptCredentials());
  }

  const res = await fetch(`${registryUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  await throwIfError(res, 'Login failed');

  const { token: authToken } = await res.json();
  saveToken(authToken);
  console.log('Logged in.');
}

module.exports = { login };
