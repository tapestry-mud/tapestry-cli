'use strict';

jest.mock('../../src/lib/registry-client');
jest.mock('../../src/lib/auth');

const { patchPreset, deletePreset } = require('../../src/lib/registry-client');
const { requireAccess } = require('../../src/lib/auth');
const { presetSet, presetDelete } = require('../../src/commands/preset');

beforeEach(() => {
  jest.clearAllMocks();
  requireAccess.mockResolvedValue('admin-token');
});

test('calls patchPreset with preset name and payload', async () => {
  patchPreset.mockResolvedValue({ name: 'starter' });
  const packs = { '@tapestry/core': '0.0.3', '@tapestry/example-pack': '0.0.2' };
  await presetSet('starter', '0.0.2', 'stable', packs);
  expect(patchPreset).toHaveBeenCalledWith(
    'starter',
    { version: '0.0.2', engine_channel: 'stable', packs },
    'admin-token',
    expect.any(String)
  );
});

test('requires login', async () => {
  requireAccess.mockRejectedValue(new Error('Not logged in. Run: tapestry login'));
  await expect(presetSet('starter', '0.0.2', 'stable', {}))
    .rejects.toThrow('Not logged in');
});

test('logs updated preset name after success', async () => {
  patchPreset.mockResolvedValue({ name: 'starter', version: '0.0.2' });
  const log = jest.spyOn(console, 'log').mockImplementation();
  await presetSet('starter', '0.0.2', 'stable', { '@tapestry/core': '0.0.3' });
  expect(log.mock.calls.flat().join(' ')).toContain('starter');
  log.mockRestore();
});

test('presetDelete calls deletePreset with name and token', async () => {
  deletePreset.mockResolvedValue({ deleted: 'bad-preset' });
  await presetDelete('bad-preset');
  expect(deletePreset).toHaveBeenCalledWith('bad-preset', 'admin-token', expect.any(String));
});

test('presetDelete requires login', async () => {
  requireAccess.mockRejectedValue(new Error('Not logged in. Run: tapestry login'));
  await expect(presetDelete('bad-preset')).rejects.toThrow('Not logged in');
});

test('presetDelete logs the deleted preset name', async () => {
  deletePreset.mockResolvedValue({ deleted: 'bad-preset' });
  const log = jest.spyOn(console, 'log').mockImplementation();
  await presetDelete('bad-preset');
  expect(log.mock.calls.flat().join(' ')).toContain('bad-preset');
  log.mockRestore();
});
