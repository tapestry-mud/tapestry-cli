# harvest

Capability spec for world-state classification and the authoring-to-pack pipeline.

## Overview

This capability covers two closely related concerns:

1. **World-state** -- classifying each authored area in the game root's `data/areas/` tree
   as Clean, Edited, Fork, or WIP by reading only on-disk side-car facts. The `tapestry status`
   command is the user-facing view of this classification.

2. **Harvest** -- promoting authored area content from the game-root side-car tree into a
   pack. Two sinks exist: the `git` sink renders the content into a linked pack repository,
   bumps the pack version, and commits; the `file` sink renders into a temp build directory
   and produces a portable `.tgz` at the current version without bumping.

The `sync-area` command is a deprecated alias for `harvest --sink git`. The `export-area`
command is a hidden deprecated alias for the same.

The area reference format is `namespace:area-id` (e.g. `legends-forgotten:village-green`).
(src/lib/pack-resolve.js:8-13)

## Behavior

### World-state classification

The state vocabulary is defined in `src/lib/world-state.js` and maps to four values:
(src/lib/world-state.js:11)

- **WIP** -- `area.yaml` exists and its `area.flags` array contains the string `wip`.
  Checked before all other states; a WIP area is not visible to players.
  (src/lib/world-state.js:14-22) (src/lib/world-state.js:51)
- **Clean** -- no room files exist under `data/areas/<area>/rooms/*.yaml`, OR all existing
  room files are byte-for-byte equal (via JSON round-trip of YAML) to their counterparts in
  the linked pack directory. (src/lib/world-state.js:57-59) (src/lib/world-state.js:64-70)
- **Edited** -- at least one room file under the side-car tree either has no counterpart in
  the pack or differs from it. The pack must be owned (namespace resolves to a linked pack).
  (src/lib/world-state.js:62-70)
- **Fork** -- the area's namespace does not resolve to any linked pack the user owns (the
  area belongs to an official or foreign pack). (src/lib/world-state.js:63-65)

Namespace is inferred from the `id` field of the first room file (`ns:key` format).
(src/lib/world-state.js:44-49)

`computeAreaStates` iterates `data/areas/` directories alphabetically. It never queries the
registry and never reads the engine's runtime state. (src/lib/world-state.js:26-77)

#### status command

Prints one line per area: `<State padded to 7> <area-dir> (<namespace>) rooms:<count> [WIP]`.
(src/commands/status.js:13-15)

Prints a legend line: "Clean = shipped; Edited = ready to harvest; Fork = owned by another
pack; WIP = hidden from players." (src/commands/status.js:18)

Prints "Strict boot remains the authority; this is a lighter on-host view."
(src/commands/status.js:19)

With `--game-root <path>`, reads `data/areas/` from that path instead of the current
directory. (src/commands/status.js:5)

### Harvest -- sink selection

`harvest` auto-detects the sink when `--sink` is not given: it calls `resolvePackDirOrNull`
for the area's namespace; if exactly one linked pack matches AND that directory is a git repo,
the git sink is used; otherwise the file sink is used.
(src/commands/harvest.js:15-19)

With `--sink git` or `--sink file`, the choice is explicit; any other value throws.
(src/commands/harvest.js:20-33)

### Harvest -- git sink (`sync-area`)

The git sink delegates entirely to `syncArea`.
(src/commands/harvest.js:21-23)

- Requires a linked pack for the namespace; throws if none or multiple match.
  (src/lib/pack-resolve.js:44-55)
- Requires `pack.yaml` in the target pack directory. (src/commands/sync-area.js:22-25)
- Asserts that the pack's namespace (derived from `manifest.name` by replacing `@scope/`
  separator with `-`) matches the area namespace. Throws on mismatch.
  (src/lib/render-core.js:91-101) (src/lib/pack-resolve.js:17-20)
- Calls `renderArea` to fold the side-car rooms into the pack (see below).
  (src/commands/sync-area.js:29)
- Bumps `pack.yaml` version using `semver.inc` at the requested level (default: patch).
  (src/lib/pack-manifest.js:71-85) (src/commands/sync-area.js:31)
- If the pack directory is a git repo, commits all changes with the message
  `content(<area>): sync authored edits, bump <old> -> <new>`.
  (src/commands/sync-area.js:33-38)
- If the pack directory is not a git repo, bumps but does not commit; warns.
  (src/commands/sync-area.js:39-41)
- `--minor` and `--major` flags set the bump level; default is patch.
  (bin/tapestry.js:406-408)
- Prints "To publish + deploy, push the pack repo" with the pack directory path.
  (src/commands/sync-area.js:46-48)

### Harvest -- file sink

The file sink never bumps the version; it captures an exact snapshot at the manifest's
current version. (src/lib/file-sink.js:19-21)

- If a linked pack exists for the namespace, copies the entire pack directory (excluding
  `.git`, `node_modules`, `.DS_Store`, and `.tgz` files) into a temp build directory.
  The rendered area content is then folded into that copy.
  (src/lib/file-sink.js:30-39) (src/lib/tarball-builder.js:7)
- If no linked pack exists (hobbyist / no owned repo), synthesizes a minimal `pack.yaml`
  using the namespace to derive `@scope/name`. (src/lib/file-sink.js:36-38)
  (src/lib/pack-manifest.js:53-68)
- Calls `renderArea` to fold the side-car rooms into the temp build directory.
  (src/lib/file-sink.js:39)
- Builds a `.tgz` from the temp dir. Output path defaults to `<shortName>-<version>.tgz`
  in the current directory; overridden with `--out <path>`. (src/lib/file-sink.js:43-49)
- Cleans up the temp directory in a `finally` block. (src/lib/file-sink.js:56-58)
- Prints "This .tgz is a portable, installable pack" after completion.
  (src/lib/file-sink.js:55-56)
- `--name <@scope/pack>` overrides the synthesized pack name (file sink only; only
  meaningful when no linked pack is found). (src/lib/file-sink.js:36)

### renderArea (shared by both sinks)

- Reads room YAML files from `<gameRoot>/data/areas/<area>/rooms/*.yaml`.
  Throws if the directory is absent or empty. (src/lib/render-core.js:13-20)
- Copies `area.yaml` from the game-root side-car if present; creates a minimal one if absent
  and the target does not already have one. (src/lib/render-core.js:26-35)
- Writes each room file to `<targetDir>/areas/<area>/rooms/<file>`, creating directories as
  needed. (src/lib/render-core.js:37-50)
- Without `--force`: throws if a room file in the target differs from the incoming side-car.
  (src/lib/render-core.js:41-45)
- With `--force`: overwrites divergent room files silently. (src/lib/render-core.js:40-49)
- After writing, calls `ensureContentGlobs` to additively add `area_definitions` and `rooms`
  glob entries to `pack.yaml` if not already present. (src/lib/render-core.js:52)
  (src/lib/pack-manifest.js:7-31)
- `reconcileDependencies` is a deliberate no-op: rooms are self-contained; the seam is wired
  for a future slice that will scan for cross-pack references in mobs/items/quests.
  (src/lib/render-core.js:63-65)

### Side-car removal (default behavior)

After rendering, unless `--keep-sidecars` is given, `removeSideCars` deletes the room files
from the game-root side-car tree and prunes the `rooms/` and area directories if they become
empty. `area.yaml` in the game root is also deleted. (src/lib/render-core.js:69-88)

## Rejected and Reverted

- `sync-area` was the original name for `harvest --sink git`. It prints a deprecation warning
  and delegates to `harvest` with `sink: 'git'` forced.
  (bin/tapestry.js:412-425)
- `export-area` is a hidden alias with the same deprecation path.
  (bin/tapestry.js:428-439)

## Change Log

- None on record.
