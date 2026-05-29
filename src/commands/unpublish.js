'use strict';

const fetch = require('node-fetch');
const { requireAccess } = require('../lib/auth');
const { DEFAULT_REGISTRY } = require('../lib/registry-client');
const { createInterface, ask } = require('../util/prompt');

function parsePackageArg(arg) {
  // Input: @scope/name@version or @scope/name
  // The version separator is the @ that comes after the slash.
  const match = arg.match(/^(@[^@]+)@(.+)$/);
  if (match) {
    return { pkg: match[1], version: match[2] };
  }
  return { pkg: arg, version: null };
}

async function unpublish(packageArg, { force = false, registryUrl = DEFAULT_REGISTRY } = {}) {
  const token = await requireAccess();
  const { pkg, version } = parsePackageArg(packageArg);

  if (!/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(pkg)) {
    throw new Error(`Invalid package name: ${pkg}. Expected @scope/name format`);
  }

  const rl = createInterface();
  let confirmed = false;
  try {
    if (version) {
      const answer = await ask(rl, `Remove ${pkg}@${version} from the registry? This cannot be undone. [y/N] `);
      confirmed = answer === 'y' || answer === 'Y';
    } else {
      console.log(`WARNING: This will permanently delete ALL versions of ${pkg}.`);
      const answer = await ask(rl, `Type the package name to confirm: `);
      confirmed = answer === pkg;
    }
  } finally {
    rl.close();
  }

  if (!confirmed) {
    console.log('Cancelled.');
    return;
  }

  const forceSuffix = force ? '?force=true' : '';
  const url = version
    ? `${registryUrl}/v1/packages/${pkg}/${version}${forceSuffix}`
    : `${registryUrl}/v1/packages/${pkg}${forceSuffix}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Unpublish failed (${res.status})`);
  }

  const body = await res.json();
  console.log(body.message);
}

module.exports = { unpublish };
