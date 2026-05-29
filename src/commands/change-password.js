'use strict';

const fetch = require('node-fetch');
const { requireAccess } = require('../lib/auth');
const { DEFAULT_REGISTRY, throwIfError } = require('../lib/registry-client');
const { createInterface, askPassword } = require('../util/prompt');

async function changePassword({ registryUrl = DEFAULT_REGISTRY } = {}) {
  const token = await requireAccess();
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
    await throwIfError(res, 'Change password failed');
    console.log('Password changed.');
  } finally {
    rl.close();
  }
}

module.exports = { changePassword };
