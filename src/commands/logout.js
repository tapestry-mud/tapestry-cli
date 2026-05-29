'use strict';

const { readSession, clearSession, DEFAULT_REGISTRY } = require('../lib/auth');
const { postLogout } = require('../lib/registry-client');

async function logout() {
  const s = readSession();
  if (s && s.refresh) {
    try {
      await postLogout(s.refresh, s.registry || DEFAULT_REGISTRY);
    } catch {
      // Best-effort server revoke; always clear the local session below.
    }
  }
  clearSession();
  console.log('Logged out.');
}

module.exports = { logout };
