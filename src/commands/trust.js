'use strict';

const { requireAccess, readSession, DEFAULT_REGISTRY } = require('../lib/auth');
const {
  createTrustedPublisher, listTrustedPublishers, deleteTrustedPublisher,
} = require('../lib/registry-client');

function registryUrl() {
  const s = readSession();
  return (s && s.registry) || DEFAULT_REGISTRY;
}

async function trustAdd(scope, repo, { ref, environment } = {}) {
  const token = await requireAccess();
  const body = { scope, repo };
  if (ref) { body.ref = ref; }
  if (environment) { body.environment = environment; }
  const row = await createTrustedPublisher(body, token, registryUrl());
  console.log(`Trusted publisher #${row.id}: @${row.scope} <- ${row.repo}`);
}

async function trustList(scope) {
  const token = await requireAccess();
  const rows = await listTrustedPublishers(scope, token, registryUrl());
  if (!rows.length) {
    console.log('No trusted publishers.');
    return;
  }
  for (const r of rows) {
    const extra = [r.ref ? `ref=${r.ref}` : null, r.environment ? `env=${r.environment}` : null]
      .filter(Boolean).join(' ');
    console.log(`#${r.id}  @${r.scope} <- ${r.repo}${extra ? `  (${extra})` : ''}`);
  }
}

async function trustRm(id) {
  const token = await requireAccess();
  await deleteTrustedPublisher(id, token, registryUrl());
  console.log(`Removed trusted publisher #${id}.`);
}

module.exports = { trustAdd, trustList, trustRm };
