'use strict';

jest.mock('../../src/lib/registry-client');
const { fetchPreset, fetchPresetList } = require('../../src/lib/registry-client');

const { init, slugify } = require('../../src/commands/init');
const { readYaml } = require('../../src/util/yaml');
const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;

const MOCK_PRESET = {
  name: 'starter',
  version: '0.0.3',
  engine_channel: 'stable',
  packs: { '@tapestry/core': '0.0.3', '@tapestry/example-pack': '0.0.3' },
};

const MOCK_PRESET_LIST = [
  { name: 'starter', version: '0.0.3', engine_channel: 'stable', updated_at: '2026-05-14T00:00:00Z' },
];

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tapestry-init-'));
  fetchPresetList.mockResolvedValue(MOCK_PRESET_LIST);
  fetchPreset.mockResolvedValue(MOCK_PRESET);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

// -------------------------
// File creation (yes mode)
// -------------------------

test('creates tapestry.yaml with project name derived from directory', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const manifest = readYaml(path.join(projectDir, 'tapestry.yaml'));
  expect(manifest.name).toBe('my-game');
});

test('tapestry.yaml engine version comes from preset, not hardcoded', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  fetchPreset.mockResolvedValue({ ...MOCK_PRESET, version: '0.0.7' });
  await init(projectDir, { yes: true });
  const manifest = readYaml(path.join(projectDir, 'tapestry.yaml'));
  expect(manifest.engine.version).toBe('0.0.7');
});

test('tapestry.yaml engine channel comes from preset', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const manifest = readYaml(path.join(projectDir, 'tapestry.yaml'));
  expect(manifest.engine.channel).toBe('stable');
});

test('tapestry.yaml engine includes mode and image', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const manifest = readYaml(path.join(projectDir, 'tapestry.yaml'));
  expect(manifest.engine.mode).toBe('docker');
  expect(manifest.engine.image).toBe('ghcr.io/tapestry-mud/tapestry');
});

test('tapestry.yaml does not include packs: [] field', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const manifest = readYaml(path.join(projectDir, 'tapestry.yaml'));
  expect(manifest.packs).toBeUndefined();
});

test('tapestry.yaml dependencies come from preset with caret ranges', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const manifest = readYaml(path.join(projectDir, 'tapestry.yaml'));
  expect(manifest.dependencies['@tapestry/core']).toBe('^0.0.3');
  expect(manifest.dependencies['@tapestry/example-pack']).toBe('^0.0.3');
});

test('creates packs/ directory', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  expect(fs.existsSync(path.join(projectDir, 'packs'))).toBe(true);
});

test('creates .gitignore with packs/ and .tapestry-engine/ entries', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const gitignore = fs.readFileSync(path.join(projectDir, '.gitignore'), 'utf8');
  expect(gitignore).toContain('packs/');
  expect(gitignore).toContain('.tapestry-engine/');
});

test('throws if tapestry.yaml already exists', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  fs.writeFileSync(path.join(projectDir, 'tapestry.yaml'), 'name: my-game\n');
  await expect(init(projectDir, { yes: true })).rejects.toThrow('tapestry.yaml already exists');
});

// -------------------------
// server.yaml content
// -------------------------

test('server.yaml has server block with name, telnet_port, websocket_port', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const serverConfig = readYaml(path.join(projectDir, 'server.yaml'));
  expect(serverConfig.server).toBeDefined();
  expect(serverConfig.server.name).toBe('my-game');
  expect(serverConfig.server.telnet_port).toBe(4000);
  expect(serverConfig.server.websocket_port).toBe(4001);
});

test('server.yaml admin block uses yes-mode defaults', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const serverConfig = readYaml(path.join(projectDir, 'server.yaml'));
  expect(serverConfig.admin).toBeDefined();
  expect(serverConfig.admin.handle).toBe('admin');
  expect(serverConfig.admin.password).toBe('changeme');
});

test('server.yaml telemetry is commented out when telemetry=false (yes mode default)', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const raw = fs.readFileSync(path.join(projectDir, 'server.yaml'), 'utf8');
  expect(raw).toContain('# telemetry:');
  expect(raw).not.toMatch(/^telemetry:/m);
});

test('server.yaml includes commented persistence section', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const raw = fs.readFileSync(path.join(projectDir, 'server.yaml'), 'utf8');
  expect(raw).toContain('# persistence:');
  expect(raw).toContain('#   save_path:');
});

test('server.yaml includes commented idle timeouts section', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const raw = fs.readFileSync(path.join(projectDir, 'server.yaml'), 'utf8');
  expect(raw).toContain('# idle:');
  expect(raw).toContain('#   pre_login_timeout_seconds:');
});

test('server.yaml includes commented MSSP section', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const raw = fs.readFileSync(path.join(projectDir, 'server.yaml'), 'utf8');
  expect(raw).toContain('# mssp:');
});

// -------------------------
// Preset picker
// -------------------------

test('auto-selects and logs preset name when list has one entry', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  const log = jest.spyOn(console, 'log').mockImplementation();
  await init(projectDir, { yes: true });
  const output = log.mock.calls.flat().join('\n');
  expect(output).toContain('Using preset: starter (engine v0.0.3, stable channel)');
  log.mockRestore();
});

test('falls back to fetchPreset("starter") when fetchPresetList returns null (old registry)', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  fetchPresetList.mockResolvedValue(null);
  await init(projectDir, { yes: true });
  expect(fetchPreset).toHaveBeenCalledWith('starter', expect.any(String));
  const manifest = readYaml(path.join(projectDir, 'tapestry.yaml'));
  expect(manifest.engine.version).toBe('0.0.3');
});

test('uses injected prompter to pick from multiple presets', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  const multiPresets = [
    { name: 'starter', version: '0.0.3', engine_channel: 'stable', updated_at: '2026-05-14T00:00:00Z' },
    { name: 'pvp-arena', version: '0.0.3', engine_channel: 'stable', updated_at: '2026-05-14T00:00:00Z' },
  ];
  fetchPresetList.mockResolvedValue(multiPresets);
  const mockPrompt = jest.fn()
    .mockResolvedValueOnce({ selectedPreset: 'starter' })
    .mockResolvedValueOnce({
      gameName: 'my-game',
      adminHandle: 'admin',
      adminPassword: 'secret123',
      adminPasswordConfirm: 'secret123',
      telemetry: false,
    });
  await init(projectDir, { prompter: mockPrompt });
  expect(mockPrompt).toHaveBeenCalledTimes(2);
  expect(fetchPreset).toHaveBeenCalledWith('starter', expect.any(String));
});

test('throws when fetchPresetList fails with non-404 error', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  fetchPresetList.mockRejectedValue(new Error('Registry unreachable'));
  await expect(init(projectDir, { yes: true })).rejects.toThrow(/registry/i);
});

// -------------------------
// Interactive wizard
// -------------------------

test('wizard mode uses prompter answers for gameName and adminHandle', async () => {
  const projectDir = path.join(tmpDir, 'any-dir');
  fs.mkdirSync(projectDir);
  const mockPrompt = jest.fn().mockResolvedValue({
    gameName: 'My Cool Mud',
    adminHandle: 'sysop',
    adminPassword: 'hunter22',
    adminPasswordConfirm: 'hunter22',
    telemetry: false,
  });
  await init(projectDir, { prompter: mockPrompt });
  const manifest = readYaml(path.join(projectDir, 'tapestry.yaml'));
  expect(manifest.name).toBe('my-cool-mud');
  const serverConfig = readYaml(path.join(projectDir, 'server.yaml'));
  expect(serverConfig.admin.handle).toBe('sysop');
  expect(serverConfig.server.name).toBe('My Cool Mud');
});

test('wizard mode: telemetry=true writes active telemetry block in server.yaml', async () => {
  const projectDir = path.join(tmpDir, 'any-dir');
  fs.mkdirSync(projectDir);
  const mockPrompt = jest.fn().mockResolvedValue({
    gameName: 'my-mud',
    adminHandle: 'sysop',
    adminPassword: 'hunter22',
    adminPasswordConfirm: 'hunter22',
    telemetry: true,
  });
  await init(projectDir, { prompter: mockPrompt });
  const raw = fs.readFileSync(path.join(projectDir, 'server.yaml'), 'utf8');
  expect(raw).toMatch(/^telemetry:/m);
  expect(raw).toContain('enabled: true');
  expect(raw).not.toContain('# telemetry:');
});

// -------------------------
// --yes mode
// -------------------------

test('yes mode uses dirName as gameName and server name', async () => {
  const projectDir = path.join(tmpDir, 'epic-mud');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const manifest = readYaml(path.join(projectDir, 'tapestry.yaml'));
  expect(manifest.name).toBe('epic-mud');
  const serverConfig = readYaml(path.join(projectDir, 'server.yaml'));
  expect(serverConfig.server.name).toBe('epic-mud');
});

test('yes mode prints warning about default credentials', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  const warn = jest.spyOn(console, 'warn').mockImplementation();
  await init(projectDir, { yes: true });
  expect(warn.mock.calls.flat().join('\n')).toContain('Default admin credentials');
  warn.mockRestore();
});

// -------------------------
// Output format
// -------------------------

test('output includes "Initialized: <name>" line', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  const log = jest.spyOn(console, 'log').mockImplementation();
  await init(projectDir, { yes: true });
  expect(log.mock.calls.flat().join('\n')).toContain('Initialized: my-game');
  log.mockRestore();
});

test('output includes engine version in tapestry.yaml line', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  const log = jest.spyOn(console, 'log').mockImplementation();
  await init(projectDir, { yes: true });
  expect(log.mock.calls.flat().join('\n')).toContain('project manifest (engine v0.0.3)');
  log.mockRestore();
});

test('output includes Next steps section with all three commands', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  const log = jest.spyOn(console, 'log').mockImplementation();
  await init(projectDir, { yes: true });
  const output = log.mock.calls.flat().join('\n');
  expect(output).toContain('Next steps:');
  expect(output).toContain('tapestry install');
  expect(output).toContain('tapestry engine install');
  expect(output).toContain('tapestry start');
  log.mockRestore();
});

test('output includes telemetry note when telemetry=true', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  const mockPrompt = jest.fn().mockResolvedValue({
    gameName: 'my-game',
    adminHandle: 'admin',
    adminPassword: 'secret1',
    adminPasswordConfirm: 'secret1',
    serverName: 'My Game',
    telemetry: true,
  });
  const log = jest.spyOn(console, 'log').mockImplementation();
  await init(projectDir, { prompter: mockPrompt });
  const output = log.mock.calls.flat().join('\n');
  expect(output).toContain('Telemetry is enabled in server.yaml');
  expect(output).toContain('observability stack');
  log.mockRestore();
});

test('logs git hint when no .git directory exists', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  const log = jest.spyOn(console, 'log').mockImplementation();
  await init(projectDir, { yes: true });
  const output = log.mock.calls.flat().join('\n');
  expect(output).toContain('git init');
  log.mockRestore();
});

test('does not log git hint when .git directory exists', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  fs.mkdirSync(path.join(projectDir, '.git'));
  const log = jest.spyOn(console, 'log').mockImplementation();
  await init(projectDir, { yes: true });
  const output = log.mock.calls.flat().join('\n');
  expect(output).not.toContain('git init');
  log.mockRestore();
});

// -------------------------
// slugify
// -------------------------

test('slugify lowercases and replaces spaces with hyphens', () => {
  expect(slugify('My Cool Mud')).toBe('my-cool-mud');
});

test('slugify strips non-slug characters', () => {
  expect(slugify('My Game! @2026')).toBe('my-game-2026');
});

test('slugify passes through already-safe names', () => {
  expect(slugify('my-mud')).toBe('my-mud');
});

test('server.yaml includes commented link_dead section', async () => {
  const projectDir = path.join(tmpDir, 'my-game');
  fs.mkdirSync(projectDir);
  await init(projectDir, { yes: true });
  const serverYaml = fs.readFileSync(path.join(projectDir, 'server.yaml'), 'utf8');
  expect(serverYaml).toContain('link_dead:');
  expect(serverYaml).toContain('enabled:');
  expect(serverYaml).toContain('timeout_seconds:');
});
