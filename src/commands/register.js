'use strict';

const fetch = require('node-fetch');
const { saveToken } = require('../lib/auth');
const { DEFAULT_REGISTRY } = require('../lib/registry-client');
const { createInterface, ask, askPassword } = require('../util/prompt');

async function promptRegistration() {
  const rl = createInterface();
  try {
    const handle = await ask(rl, 'Handle (lowercase, e.g. mallek): ');
    const email = await ask(rl, 'Email: ');
    const password = await askPassword(rl, 'Password: ');
    return { handle, email, password };
  } finally {
    rl.close();
  }
}

async function register({ handle, email, password } = {}, { registryUrl = DEFAULT_REGISTRY } = {}) {
  if (!handle || !email || !password) {
    ({ handle, email, password } = await promptRegistration());
  }

  const res = await fetch(`${registryUrl}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle, email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Registration failed (${res.status})`);
  }

  const { token } = await res.json();
  saveToken(token);
  console.log(`Registered as ${handle}. Logged in.`);
}

module.exports = { register };
