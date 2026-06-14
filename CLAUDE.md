# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@tapestry-mud/cli` is a Node.js CLI that manages Tapestry MUD game projects: scaffolding, pack management, registry operations, and engine lifecycle. Entry point: `bin/tapestry.js`. Commands are wired via `commander`.

## Commands

```sh
npm ci          # install deps
npm test        # run all tests (jest)
npx jest test/path/to/file.test.js   # run a single test file
npx jest --testNamePattern "name"    # run tests matching a name
```

No build step. No lint config in this repo.

## Running the CLI locally

```sh
node bin/tapestry.js <command>
```

## Layout

```
bin/            entry point (tapestry.js)
src/
  commands/     one file per CLI command (~30 commands)
  lib/          shared logic (auth, registry client, pack ops, etc.)
  schema/       zod schemas
  scaffold/     template files for `tapestry init`
  util/         small helpers
specs/          capability specs -- source of truth for system behavior
test/           jest tests, mirrors src/ structure
```

## System behavior

All behavior is documented in `specs/`. Read the relevant spec before changing any command logic. `specs/README.md` lists the index and explains the format contract (anchored claims, change records, lint rules).
