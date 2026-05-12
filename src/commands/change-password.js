'use strict';

const fetch = require('node-fetch');
const { requireToken } = require('../lib/auth');
const { DEFAULT_REGISTRY } = require('../lib/registry-client');
const { createInterface, askPassword } = require('../util/prompt');

async function changePassword({ registryUrl = DEFAULT_REGISTRY } = {}) {
  const token = requireToken();
  const rl = createInterface();
  try {
    const currentPassword = await askPassword(rl, 'Current password: ');
    const newPassword = await askPassword(rl, 'New password: ');
    const confirm = await askPassword(rl, 'Confirm new password: ');
    if (newPassword !== confirm) {
      throw new Error('Passwords do not match');
    }
    const res = await fetch(`${registryUrl}/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Change password failed (${res.status})`);
    }
    console.log('Password changed.');
  } finally {
    rl.close();
  }
}

module.exports = { changePassword };
