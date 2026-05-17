'use strict';

const fs = require('fs');
const path = require('path');
const { fetchPreset, fetchPresetList, DEFAULT_REGISTRY } = require('../lib/registry-client');

function slugify(str) {
  return str.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_.-]/g, '');
}

function buildManifest(name, deps, engineVersion, engineChannel) {
  const depLines = Object.entries(deps)
    .map(([pkg, range]) => `  '${pkg}': '${range}'`)
    .join('\n');
  return [
    `name: ${name}`,
    `engine:`,
    `  version: '${engineVersion}'`,
    `  channel: ${engineChannel}`,
    `  mode: docker`,
    `  image: ghcr.io/tapestry-mud/tapestry`,
    `dependencies:`,
    depLines,
    `  # Add more packs here. Run: tapestry install @scope/pack-name`,
    `validation: strict`,
    ``,
    `# Server port, admin seed account, and engine settings are in server.yaml`,
  ].join('\n');
}

function buildServerYaml({ serverName, adminHandle, adminEmail, adminPassword, telemetry }) {
  const telemetryBlock = telemetry
    ? [
        `telemetry:`,
        `  enabled: true`,
        `  endpoint: "http://localhost:4317"`,
        `  protocol: grpc`,
        `  service_name: tapestry`,
      ].join('\n')
    : [
        `# telemetry:`,
        `#   enabled: true`,
        `#   endpoint: "http://localhost:4317"`,
        `#   protocol: grpc`,
        `#   service_name: tapestry`,
      ].join('\n');

  return [
    `# Tapestry server configuration`,
    `# Uncomment and modify sections as needed.`,
    `# Docs: https://tapestryengine.com/docs/config`,
    ``,
    `server:`,
    `  name: "${serverName}"`,
    `  telnet_port: 4000`,
    `  websocket_port: 4001`,
    `  max_connections: 200`,
    `  tick_rate_ms: 100`,
    ``,
    `admin:`,
    `  handle: ${adminHandle}`,
    `  email: ${adminEmail}`,
    `  password: ${adminPassword}`,
    ``,
    `# --- Telemetry (OpenTelemetry) ---`,
    `# Requires the observability stack. In 0.4.0: tapestry telemetry start`,
    telemetryBlock,
    ``,
    `# --- Logging ---`,
    `# logging:`,
    `#   level: Information`,
    ``,
    `# --- Persistence ---`,
    `# persistence:`,
    `#   save_path: "./data/saves"`,
    `#   connections_path: "./data/connections"`,
    `#   autosave_interval: 3000`,
    `#   password_min_length: 6`,
    `#   max_login_attempts: 5`,
    ``,
    `# --- Idle Timeouts ---`,
    `# idle:`,
    `#   pre_login_timeout_seconds: 120`,
    `#   phase_timeouts:`,
    `#     name: 60`,
    `#     password: 30`,
    `#     session_takeover: 15`,
    `#     creating: 300`,
    ``,
    `# --- MSSP (MUD Server Status Protocol) ---`,
    `# mssp:`,
    `#   name: "${serverName}"`,
    `#   codebase: "Tapestry"`,
    `#   hostname: ""`,
    `#   port: 4000`,
    ``,
    `# --- LLM ---`,
    `# llm:`,
    `#   provider: none`,
    ``,
    `# --- Networking ---`,
    `# networking:`,
    `#   negotiation_timeout_ms: 500`,
    ``,
    `# --- Pre-Auth (web client token auth) ---`,
    `# pre_auth:`,
    `#   enabled: false`,
    `#   token_expiry_seconds: 60`,
    ``,
    `# --- Accounts ---`,
    `# accounts:`,
    `#   max_concurrent_characters: 1`,
    ``,
    `# --- Link-Dead (player disconnect grace period) ---`,
    `# link_dead:`,
    `#   enabled: true`,
    `#   timeout_seconds: 120`,
  ].join('\n');
}

async function init(cwd, { registryUrl = DEFAULT_REGISTRY, yes = false, prompter = null } = {}) {
  if (cwd === undefined) {
    cwd = process.cwd();
  }

  const manifestPath = path.join(cwd, 'tapestry.yaml');
  if (fs.existsSync(manifestPath)) {
    throw new Error('tapestry.yaml already exists. Run tapestry install to install dependencies.');
  }

  let preset;
  try {
    const presets = await fetchPresetList(registryUrl);
    if (presets === null) {
      preset = await fetchPreset('starter', registryUrl);
      console.log(`Using preset: starter (engine v${preset.version}, ${preset.engine_channel} channel)`);
    } else if (presets.length === 1) {
      console.log(`Using preset: ${presets[0].name} (engine v${presets[0].version}, ${presets[0].engine_channel} channel)`);
      preset = await fetchPreset(presets[0].name, registryUrl);
    } else {
      const doPrompt = prompter || require('inquirer').prompt;
      const { selectedPreset } = await doPrompt([{
        type: 'list',
        name: 'selectedPreset',
        message: 'Select a preset:',
        choices: presets.map(p => ({
          name: `${p.name} (engine v${p.version}, ${p.engine_channel} channel)`,
          value: p.name,
        })),
      }]);
      preset = await fetchPreset(selectedPreset, registryUrl);
      console.log(`Using preset: ${selectedPreset} (engine v${preset.version}, ${preset.engine_channel} channel)`);
    }
  } catch (e) {
    throw new Error(`Failed to fetch presets from registry: ${e.message}. Check your connection and try again.`);
  }

  const deps = {};
  for (const [pkg, ver] of Object.entries(preset.packs)) {
    deps[pkg] = `^${ver}`;
  }

  const dirName = path.basename(cwd);
  let answers;

  if (yes) {
    answers = {
      gameName: dirName,
      adminHandle: 'admin',
      adminEmail: 'admin@localhost',
      adminPassword: 'changeme',
      telemetry: false,
    };
    console.warn('Default admin credentials -- change in server.yaml before production use.');
  } else {
    const doPrompt = prompter || require('inquirer').prompt;
    answers = await doPrompt([
      {
        type: 'input',
        name: 'gameName',
        message: 'Game name:',
        default: dirName,
        validate: (v) => v.trim().length > 0 || 'Required',
      },
      {
        type: 'input',
        name: 'adminHandle',
        message: 'Admin handle:',
        validate: (v) => (v.trim().length > 0 && !/\s/.test(v)) || 'Required, no spaces',
      },
      {
        type: 'input',
        name: 'adminEmail',
        message: 'Admin email:',
        validate: (v) => {
          v = v.trim();
          if (!v) { return 'Required'; }
          if (!v.includes('@') || !v.includes('.')) { return 'Must be a valid email'; }
          return true;
        },
      },
      {
        type: 'password',
        name: 'adminPassword',
        message: 'Admin password:',
        mask: '*',
        validate: (v) => v.length >= 6 || 'Minimum 6 characters',
      },
      {
        type: 'password',
        name: 'adminPasswordConfirm',
        message: 'Confirm admin password:',
        mask: '*',
        validate: (v, a) => v === a.adminPassword || 'Passwords do not match',
      },
      {
        type: 'confirm',
        name: 'telemetry',
        message: 'Enable telemetry?',
        default: false,
      },
    ]);
  }

  const name = slugify(answers.gameName);

  fs.writeFileSync(manifestPath, buildManifest(name, deps, preset.version, preset.engine_channel));
  fs.writeFileSync(
    path.join(cwd, 'server.yaml'),
    buildServerYaml({
      serverName: answers.gameName,
      adminHandle: answers.adminHandle,
      adminEmail: answers.adminEmail,
      adminPassword: answers.adminPassword,
      telemetry: answers.telemetry,
    })
  );
  fs.mkdirSync(path.join(cwd, 'packs'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, '.gitignore'),
    '# Installed packages (managed by tapestry install)\npacks/\n\n# Engine artifacts (managed by tapestry engine install)\n.tapestry-engine/\n\n# Game data (players, saves)\ndata/\n'
  );

  console.log('');
  console.log(`Initialized: ${name}`);
  console.log(`  tapestry.yaml  project manifest (engine v${preset.version})`);
  console.log(`  server.yaml    engine config`);
  console.log(`  packs/         installed packages`);
  console.log(`  .gitignore     excludes packs/ and .tapestry-engine/ from git`);
  console.log('');
  console.log('Next steps:');
  console.log('  tapestry install          install packs');
  console.log('  tapestry engine install   pull the engine image');
  console.log('  tapestry start            boot the server');

  if (answers.telemetry) {
    console.log('');
    console.log('  Telemetry is enabled in server.yaml.');
    console.log('  The observability stack (Grafana, Prometheus, Loki, Jaeger) must be');
    console.log('  running for telemetry data to be collected. See docs for setup.');
  }

  if (!fs.existsSync(path.join(cwd, '.git'))) {
    console.log('');
    console.log('Hint: no git repo detected. Run: git init');
  }
}

module.exports = { init, buildManifest, buildServerYaml, slugify };
