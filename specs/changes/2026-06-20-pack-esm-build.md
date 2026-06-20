---
release: 0.10.0
specs: [pack-lifecycle.md]
---

# Pack ESM Build

## Why

Packs are authored in TypeScript and ship native ES modules, but the CLI had no
build step: `pack` and `publish` archived whatever was on disk. An ESM pack
declares `content.scripts_format: esm` and points `content.scripts` at compiled
output under `dist/scripts/`, which is gitignored - so without a compile the
tarball shipped no runnable scripts. Pack authors also had no typed surface for
the engine API they call, so editors could not check `tapestry.*` usage.

## What

- `pack` and `publish` compile an ESM pack's `scripts/**/*.ts` to
  `dist/scripts/**/*.js` with the bundled `tsc` and the pack's `tsconfig.json`
  before building the tarball. The compile runs before any network or auth work
  in `publish`. Legacy packs (no `scripts_format: esm`) are a no-op, so the step
  is backward compatible.
- New `tapestry types` command vendors the `@tapestry/engine` type definitions
  into a project's `types/` so `tsc` and editors can type-check pack scripts
  against the engine API surface the pack calls.
- `typescript` is pinned exactly as a CLI dependency (no caret) so the compile is
  reproducible.
