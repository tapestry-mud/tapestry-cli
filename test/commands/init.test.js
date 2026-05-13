'use strict';

jest.mock('../../src/lib/registry-client');
const { fetchPreset } = require('../../src/lib/registry-client');

const { init } = require('../../src/commands/init');
const { readYaml } = require('../../src/util/yaml');
const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;

beforeEach(() => {
  {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tapestry-init-'));
    fetchPreset.mockResolvedValue({
      version: '0.0.1',
      packs: { '@tapestry/core': '0.0.1', '@tapestry/example-pack': '0.0.1' },
    });
  }
});

afterEach(() => {
  {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('creates tapestry.yaml with project name derived from directory', async () => {
  {
    const projectDir = path.join(tmpDir, 'my-game');
    fs.mkdirSync(projectDir);
    await init(projectDir);
    const manifest = readYaml(path.join(projectDir, 'tapestry.yaml'));
    expect(manifest.name).toBe('my-game');
  }
});

test('tapestry.yaml includes engine config and default dependencies', async () => {
  {
    const projectDir = path.join(tmpDir, 'my-game');
    fs.mkdirSync(projectDir);
    await init(projectDir);
    const manifest = readYaml(path.join(projectDir, 'tapestry.yaml'));
    expect(manifest.engine).toMatchObject({
      version: '0.0.1',
      mode: 'docker',
      image: 'ghcr.io/tapestry-mud/tapestry',
    });
    expect(manifest.dependencies).toBeDefined();
    expect(Object.keys(manifest.dependencies)).toHaveLength(2);
    expect(manifest.dependencies).toHaveProperty('@tapestry/core');
    expect(manifest.dependencies).toHaveProperty('@tapestry/example-pack');
  }
});

test('creates server.yaml', async () => {
  {
    const projectDir = path.join(tmpDir, 'my-game');
    fs.mkdirSync(projectDir);
    await init(projectDir);
    expect(fs.existsSync(path.join(projectDir, 'server.yaml'))).toBe(true);
  }
});

test('server.yaml includes admin block with TODO handle and changeme password', async () => {
  {
    const projectDir = path.join(tmpDir, 'my-game');
    fs.mkdirSync(projectDir);
    await init(projectDir);
    const serverConfig = readYaml(path.join(projectDir, 'server.yaml'));
    expect(serverConfig.admin).toBeDefined();
    expect(serverConfig.admin.handle).toBe('TODO');
    expect(serverConfig.admin.password).toBe('changeme');
  }
});

test('creates packs/ directory', async () => {
  {
    const projectDir = path.join(tmpDir, 'my-game');
    fs.mkdirSync(projectDir);
    await init(projectDir);
    expect(fs.existsSync(path.join(projectDir, 'packs'))).toBe(true);
  }
});

test('creates .gitignore with packs/ and .tapestry-engine/ entries', async () => {
  {
    const projectDir = path.join(tmpDir, 'my-game');
    fs.mkdirSync(projectDir);
    await init(projectDir);
    const gitignore = fs.readFileSync(path.join(projectDir, '.gitignore'), 'utf8');
    expect(gitignore).toContain('packs/');
    expect(gitignore).toContain('.tapestry-engine/');
  }
});

test('logs git hint when no .git directory exists', async () => {
  {
    const projectDir = path.join(tmpDir, 'my-game');
    fs.mkdirSync(projectDir);
    const log = jest.spyOn(console, 'log').mockImplementation();
    await init(projectDir);
    const output = log.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('git init');
    log.mockRestore();
  }
});

test('does not log git hint when .git directory exists', async () => {
  {
    const projectDir = path.join(tmpDir, 'my-game');
    fs.mkdirSync(projectDir);
    fs.mkdirSync(path.join(projectDir, '.git'));
    const log = jest.spyOn(console, 'log').mockImplementation();
    await init(projectDir);
    const output = log.mock.calls.map(c => c[0]).join('\n');
    expect(output).not.toContain('git init');
    log.mockRestore();
  }
});

test('throws if tapestry.yaml already exists', async () => {
  {
    const projectDir = path.join(tmpDir, 'my-game');
    fs.mkdirSync(projectDir);
    fs.writeFileSync(path.join(projectDir, 'tapestry.yaml'), 'name: my-game\n');
    await expect(init(projectDir)).rejects.toThrow('tapestry.yaml already exists');
  }
});

describe('init with preset fetch', () => {
  let projectDir;

  beforeEach(() => {
    projectDir = path.join(tmpDir, 'preset-game');
    fs.mkdirSync(projectDir);
    fetchPreset.mockReset();
  });

  test('writes preset pack versions as ^ ranges when preset fetch succeeds', async () => {
    fetchPreset.mockResolvedValue({
      name: 'starter',
      version: '0.0.3',
      engine_channel: 'stable',
      packs: { '@tapestry/core': '0.0.3', '@tapestry/example-pack': '0.0.2' },
    });
    await init(projectDir);
    const manifest = readYaml(path.join(projectDir, 'tapestry.yaml'));
    expect(manifest.dependencies['@tapestry/core']).toBe('^0.0.3');
    expect(manifest.dependencies['@tapestry/example-pack']).toBe('^0.0.2');
  });

  test('prints "Initializing Tapestry Starter vX" when preset fetch succeeds', async () => {
    fetchPreset.mockResolvedValue({
      name: 'starter',
      version: '0.0.42',
      engine_channel: 'stable',
      packs: { '@tapestry/core': '0.0.3' },
    });
    const log = jest.spyOn(console, 'log').mockImplementation();
    await init(projectDir);
    expect(log.mock.calls.flat().join('\n')).toContain('Initializing Tapestry Starter v0.0.42');
    log.mockRestore();
  });

  test('throws when preset fetch fails', async () => {
    fetchPreset.mockRejectedValue(new Error('Registry unreachable'));
    await expect(init(projectDir)).rejects.toThrow(/registry/i);
  });
});
