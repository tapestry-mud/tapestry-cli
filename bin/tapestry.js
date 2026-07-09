#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const { version } = require('../package.json');
const { init } = require('../src/commands/init');
const { createPack } = require('../src/commands/create-pack');
const { install } = require('../src/commands/install');
const { uninstall } = require('../src/commands/uninstall');
const { update } = require('../src/commands/update');
const { enable } = require('../src/commands/enable');
const { disable } = require('../src/commands/disable');
const { login } = require('../src/commands/login');
const { logout } = require('../src/commands/logout');
const { register } = require('../src/commands/register');
const { validate } = require('../src/commands/validate');
const { pack } = require('../src/commands/pack');
const { publish } = require('../src/commands/publish');
const { search } = require('../src/commands/search');
const { info } = require('../src/commands/info');
const { list } = require('../src/commands/list');
const { link, unlink, linkList } = require('../src/commands/link');
const { outdated } = require('../src/commands/outdated');
const { engineInstall, engineUpdate, engineInfo } = require('../src/commands/engine');
const { engineVersions } = require('../src/commands/engine-versions');
const { startCmd } = require('../src/commands/start');
const { stopCmd } = require('../src/commands/stop');
const { changePassword } = require('../src/commands/change-password');
const { unpublish } = require('../src/commands/unpublish');
const { distTagSet, distTagList } = require('../src/commands/dist-tag');
const { presetSet, presetDelete } = require('../src/commands/preset');
const { trustAdd, trustList, trustRm } = require('../src/commands/trust');
const { syncArea } = require('../src/commands/sync-area');
const { harvest } = require('../src/commands/harvest');
const { status } = require('../src/commands/status');
const { types } = require('../src/commands/types');

const program = new Command();

program
  .name('tapestry')
  .description('Tapestry Package Manager')
  .version(version);

program.configureHelp({
  formatHelp(cmd, helper) {
    const groups = [
      {
        title: 'Pack Management',
        commands: ['uninstall', 'update', 'list', 'enable', 'disable', 'outdated', 'link', 'unlink'],
      },
      {
        title: 'Engine',
        commands: ['engine'],
      },
      {
        title: 'Registry',
        commands: ['search', 'info'],
      },
      {
        title: 'Account',
        commands: ['register', 'login', 'logout', 'change-password'],
      },
      {
        title: 'Pack Authoring',
        commands: ['create', 'validate', 'pack', 'publish', 'unpublish', 'harvest', 'status', 'types'],
      },
      {
        title: 'Trusted Publishing',
        commands: ['trust'],
      },
      {
        title: 'Admin',
        commands: ['dist-tag', 'preset'],
      },
    ];

    const cmdMap = new Map();
    for (const sub of cmd.commands) {
      cmdMap.set(sub.name(), sub);
    }

    const pad = 28;
    let out = `Usage: ${helper.commandUsage(cmd)}\n\n`;
    out += 'Tapestry Package Manager\n\n';
    out += 'Quick start:\n';
    out += `  ${'init'.padEnd(pad)}Scaffold a new game project\n`;
    out += `  ${'install'.padEnd(pad)}Install packs from the registry\n`;
    out += `  ${'start'.padEnd(pad)}Launch the engine (auto-pulls if needed)\n`;
    out += `  ${'stop'.padEnd(pad)}Stop the running engine\n`;
    out += '  telnet localhost 4000\n\n';

    for (const group of groups) {
      out += `${group.title}:\n`;
      for (const name of group.commands) {
        const sub = cmdMap.get(name);
        if (sub) {
          const usage = sub.options.length ? `${name} [options]` : name;
          out += `  ${usage.padEnd(pad)}${sub.description()}\n`;
        }
      }
      out += '\n';
    }

    out += 'Options:\n';
    for (const opt of helper.visibleOptions(cmd)) {
      out += `  ${helper.optionTerm(opt).padEnd(pad)}${helper.optionDescription(opt)}\n`;
    }

    return out;
  },
});

program
  .command('init')
  .description('Initialize a new Tapestry game project in the current directory')
  .option('-y, --yes', 'Skip prompts and use defaults (for CI and scripting)')
  .action(async (options) => {
    try {
      await init(undefined, { yes: !!options.yes });
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

const createCmd = program.command('create').description('Scaffold new content');

createCmd
  .command('pack <name>')
  .description('Scaffold a new pack with annotated example content')
  .action((name) => {
    try {
      createPack(name);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

const distTagCmd = program.command('dist-tag').description('Manage dist-tags for a registry package');

distTagCmd
  .command('set <pack> <tag> <version>')
  .description('Set a dist-tag on a pack version (owner or admin only)')
  .action(async (pack, tag, version) => {
    try {
      await distTagSet(pack, tag, version);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

distTagCmd
  .command('list <pack>')
  .description('List all dist-tags for a pack')
  .action(async (pack) => {
    try {
      await distTagList(pack);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

const presetCmd = program.command('preset').description('Manage registry presets (admin only)');

presetCmd
  .command('set <name> <version> <engine-channel> <packs>')
  .description('Update a preset with pinned pack versions (packs: JSON string)')
  .action(async (name, version, engineChannel, packsJson) => {
    try {
      const packs = JSON.parse(packsJson);
      await presetSet(name, version, engineChannel, packs);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

presetCmd
  .command('delete <name>')
  .description('Delete a preset from the registry')
  .action(async (name) => {
    try {
      await presetDelete(name);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('install [package]')
  .description('Install a package or all dependencies from tapestry.yaml')
  .action(async (pkg) => {
    try {
      await install(pkg || undefined);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('uninstall <package>')
  .description('Remove an installed package')
  .action(async (pkg) => {
    try {
      await uninstall(pkg);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('update [package]')
  .description('Update a package or all packages to latest compatible versions')
  .action(async (pkg) => {
    try {
      await update(pkg || undefined);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('enable <package>')
  .description('Activate a package in the engine boot order')
  .action(async (pkg) => {
    try {
      await enable(pkg);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('disable <package>')
  .description('Remove a package from the engine boot order without deleting files')
  .action(async (pkg) => {
    try {
      await disable(pkg);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('login')
  .description('Authenticate with the registry (interactive password login)')
  .action(async () => {
    try {
      await login();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('logout')
  .description('Revoke your session and remove ~/.tapestryrc')
  .action(async () => {
    try {
      await logout();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('register')
  .description('Create an account on the registry')
  .action(async () => {
    try {
      await register();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

const trustCmd = program.command('trust').description('Manage trusted publishers (OIDC CI publishing)');

trustCmd
  .command('add <scope> <repo>')
  .description('Authorize a GitHub repo (owner/name) to publish to a scope via OIDC')
  .option('--ref <ref>', 'Restrict to a git ref, e.g. refs/heads/master')
  .option('--environment <env>', 'Restrict to a GitHub Actions environment')
  .action(async (scope, repo, options) => {
    try {
      await trustAdd(scope, repo, { ref: options.ref, environment: options.environment });
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

trustCmd
  .command('list')
  .description('List trusted publishers you own (all, if admin)')
  .option('--scope <scope>', 'Filter by scope')
  .action(async (options) => {
    try {
      await trustList(options.scope);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

trustCmd
  .command('rm <id>')
  .description('Remove a trusted publisher binding by id')
  .action(async (id) => {
    try {
      await trustRm(id);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate pack.yaml in the current directory')
  .action(() => {
    try {
      validate();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('pack')
  .description('Build a tarball from the current pack directory for local inspection')
  .action(async () => {
    try {
      await pack();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('publish')
  .description('Build and upload the current pack to the registry')
  .action(async () => {
    try {
      await publish();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show world state per area (Clean / Edited / Fork / WIP)')
  .option('--game-root <path>', 'Game root containing data/ (default: current dir)')
  .action((opts) => {
    try {
      status({ cwd: process.cwd(), gameRoot: opts.gameRoot });
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('types')
  .description('Write the @tapestry/engine type declarations into types/ for ESM pack authoring')
  .action(() => {
    try {
      types({});
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

async function runHarvest(areaRef, opts) {
  try {
    await harvest(areaRef, {
      cwd: process.cwd(),
      gameRoot: opts.gameRoot,
      pack: opts.pack,
      sink: opts.sink,
      out: opts.out,
      name: opts.name,
      force: opts.force,
      keepSidecars: opts.keepSidecars,
      bump: opts.major ? 'major' : opts.minor ? 'minor' : 'patch',
    });
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }
}

program
  .command('harvest <areaRef>')
  .description('Harvest an authored area into a portable pack (areaRef = namespace:area-id)')
  .option('--sink <sink>', 'Output sink: file | git | registry (auto-detected by default)')
  .option('--out <path>', '(file sink) where the .tgz lands')
  .option('--name <name>', '(file/registry sink, fork) target pack name (@scope/pack, or @scope/fork-name for fork)')
  .option('--pack <dir>', 'Target pack directory (auto-detected from linked packs by default)')
  .option('--game-root <path>', 'Game root containing data/ (default: current dir)')
  .option('--keep-sidecars', 'Copy instead of move (leave the game-root side-cars in place)')
  .option('--force', 'Overwrite pack files that diverge from the side-car')
  .option('--minor', 'Bump the pack minor version (git/registry sink, owned pack only; default: patch)')
  .option('--major', 'Bump the pack major version (git/registry sink, owned pack only; default: patch)')
  .action(runHarvest);

// Deprecated: sync-area is now harvest --sink git.
program
  .command('sync-area <areaRef>')
  .description('(deprecated) alias for harvest --sink git')
  .option('--pack <dir>', 'Target pack directory (auto-detected from linked packs by default)')
  .option('--game-root <path>', 'Game root containing data/ (default: current dir)')
  .option('--keep-sidecars', 'Copy instead of move (leave the game-root side-cars in place)')
  .option('--force', 'Overwrite pack files that diverge from the side-car')
  .option('--minor', 'Bump the pack minor version (default: patch)')
  .option('--major', 'Bump the pack major version (default: patch)')
  .action((areaRef, opts) => {
    console.warn('warning: `sync-area` is deprecated; use `harvest <area>` (auto-detects the git sink for an owned repo).');
    runHarvest(areaRef, Object.assign({ sink: 'git' }, opts));
  });

program
  .command('export-area <areaRef>', { hidden: true })
  .description('(deprecated) alias for harvest --sink git')
  .option('--pack <dir>', 'Target pack directory (auto-detected from linked packs by default)')
  .option('--game-root <path>', 'Game root containing data/ (default: current dir)')
  .option('--keep-sidecars', 'Copy instead of move (leave the game-root side-cars in place)')
  .option('--force', 'Overwrite pack files that diverge from the side-car')
  .option('--minor', 'Bump the pack minor version (default: patch)')
  .option('--major', 'Bump the pack major version (default: patch)')
  .action((areaRef, opts) => {
    console.warn('warning: `export-area` is deprecated; use `harvest <area> --sink git`.');
    runHarvest(areaRef, Object.assign({ sink: 'git' }, opts));
  });

program
  .command('search <query>')
  .description('Search the registry by keyword')
  .action(async (query) => {
    try {
      await search(query);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('info <package>')
  .description('Show details for a registry package')
  .action(async (pkg) => {
    try {
      await info(pkg);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('Show installed packages with version, type, and enabled/disabled status')
  .action(async () => {
    try {
      await list();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('outdated')
  .description('Show installed packages with newer versions available in the registry')
  .action(async () => {
    try {
      await outdated();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('link [path]')
  .description('Attach a local pack working copy to this project (use --list to show links)')
  .option('--list', 'List active links instead of creating one')
  .option('--skip-install', 'Skip dependency resolution; warn about missing deps instead')
  .action(async (linkPath, options) => {
    try {
      if (options.list || !linkPath) {
        await linkList();
      } else {
        await link(linkPath, { noInstall: !!options.skipInstall });
      }
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('unlink <name>')
  .description('Detach a linked pack and restore the registry copy on next install')
  .action(async (name) => {
    try {
      await unlink(name);
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

const engineCmd = program.command('engine').description('Manage the Tapestry engine');

engineCmd
  .command('install')
  .description('Fetch the engine artifact for the configured mode (docker/binary/source)')
  .action(async () => {
    try {
      await engineInstall();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

engineCmd
  .command('update')
  .description('Update the engine to the configured version')
  .action(async () => {
    try {
      await engineUpdate();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

engineCmd
  .command('info')
  .description('Show installed engine version, mode, and image or path')
  .action(() => {
    try {
      engineInfo();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

engineCmd
  .command('versions')
  .description('List available engine channels from the registry')
  .action(async () => {
    try {
      await engineVersions();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Launch the Tapestry engine')
  .action(async () => {
    try {
      await startCmd();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop the running Tapestry engine')
  .action(async () => {
    try {
      await stopCmd();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('change-password')
  .description('Change your registry account password')
  .action(async () => {
    try {
      await changePassword();
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('unpublish <package>')
  .description('Remove a package version or all versions from the registry')
  .option('--force', 'Admin override: bypass ownership check')
  .action(async (pkg, options) => {
    try {
      await unpublish(pkg, { force: !!options.force });
    } catch (e) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
