# pack-lifecycle

Capability spec for project scaffolding, pack installation and removal, boot-order management,
local development linking, tarball building, and publishing to the registry.

## Overview

pack-lifecycle covers the full lifecycle a user exercises to create a game project and manage
its installed packs: scaffolding a new project (`tapestry init`), installing and removing
packs from the registry, updating to newer compatible versions, toggling packs in or out of
the engine boot order, attaching a local working copy for development (`link`), building a
pack tarball for inspection, and publishing or unpublishing a pack on the registry.

Supporting commands `create pack`, `list`, and `outdated` are also in this boundary.

The project manifest is `tapestry.yaml`; the lock file is `tapestry-lock.yaml`; the boot
order file is `tapestry-boot.yaml`; links are tracked in `tapestry-links.yaml`.

## Behavior

### init

- Aborts if `tapestry.yaml` already exists in the target directory.
  (src/commands/init.js:127-129)
- Fetches the preset list from the registry (`/v1/presets`). If the list endpoint returns 404,
  falls back to fetching the `starter` preset directly. If exactly one preset is available it
  is selected automatically; if multiple exist, the user is prompted to choose.
  (src/commands/init.js:133-151)
- With `--yes`, skips all interactive prompts and uses directory name as game name, handle
  `admin`, email `admin@localhost`, password `changeme`, telemetry off; prints a warning about
  default credentials. (src/commands/init.js:166-175)
- Writes `tapestry.yaml` with the preset's engine version and channel, and dependency ranges
  pinned with a `^` prefix from the preset's pack versions. (src/commands/init.js:157-161)
  (src/commands/init.js:226-227)
- Writes `server.yaml` with server name, telnet port 4000, websocket port 4001, admin handle
  and email, and telemetry block (commented out unless telemetry was selected).
  (src/commands/init.js:228-229)
- Creates a `packs/` directory and a `.gitignore` excluding `packs/`, `.tapestry-engine/`,
  `tapestry-links.yaml`, and `data/`. (src/commands/init.js:238-241)
- Warns if no `.git` directory is found. (src/commands/init.js:263-266)
- `buildManifest` and `buildServerYaml` are exported for test injection.
  (src/commands/init.js:269)

### install

- Requires `tapestry.yaml`; throws if absent. (src/commands/install.js:83-86)
- With no argument, skips all linked packs, then checks whether the lock file is current
  (deps_hash matches a SHA-256 of the sorted `name@range` dependency entries). If current,
  installs from the lock; otherwise resolves freshly via the registry.
  (src/commands/install.js:107-122) (src/lib/lock-file.js:10-13)
- With a package argument (`@scope/name` or `@scope/name@range`), adds or updates the entry
  in `tapestry.yaml` dependencies with the resolved version pinned at `^version`, then
  installs. (src/commands/install.js:92-106)
- Skips a package entirely if it is already linked (local working copy takes precedence).
  (src/commands/install.js:37-41)
- Skips a package if the installed version already matches the resolved version.
  (src/commands/install.js:50-54)
- Downloads each tarball to a temp file, verifies its `sha256-` integrity hash, extracts into
  `packs/<scope>/<name>/`, then removes the temp file. (src/commands/install.js:64-75)
- After installing, calls `addPackageToBoot` to register the pack (and any module entry)
  in `tapestry-boot.yaml`. (src/commands/install.js:77-78)
- Writes the lock file with `lockfile_version: 1`, `deps_hash`, and the full resolved map.
  (src/commands/install.js:128)

### uninstall

- Requires `tapestry.yaml` and that the package appears in `dependencies`; throws otherwise.
  (src/commands/uninstall.js:14-22)
- Deletes `packs/<scope>/<name>/` if present. (src/commands/uninstall.js:24-28)
- Removes the entry from `tapestry.yaml` and from `lock.resolved`, then writes both files.
  (src/commands/uninstall.js:29-39)
- Removes the pack (and its module entry) from `tapestry-boot.yaml`.
  (src/commands/uninstall.js:40)
- Transitive dependencies are NOT automatically removed; a note to run `tapestry install` is
  printed. (src/commands/uninstall.js:43)

### update

- Resolves fresh versions for all dependencies (or one if a package name is given), bypassing
  the lock file. Merges with the existing lock so packages not being updated keep their pinned
  entries. (src/commands/update.js:36-43)
- Does NOT pass an auth token to the resolver (update.js:39 calls `resolve(deps, url)` with
  no token, unlike install which passes `loadAccess()`). UNVERIFIED: whether this prevents
  updating private packs; the install path always loads the token.
- Deletes the old install directory before downloading the new version.
  (src/commands/update.js:54-62)
- Updates `tapestry-boot.yaml` for the new version via `addPackageToBoot`.
  (src/commands/update.js:80-81)
- Reports "up to date" and skips download when the resolved version matches what the lock
  already has. (src/commands/update.js:46-49)

### enable / disable

- Both require `tapestry.yaml`. (src/commands/enable.js:4-9) (src/commands/disable.js:1-16)
- Delegate to `enablePackage` / `disablePackage` in boot.js, which set `enabled: true/false`
  on the pack entry and on every module entry for that package in `tapestry-boot.yaml`.
  (src/lib/boot.js:51-76)
- Throw if the package is not in `tapestry-boot.yaml`. (src/lib/boot.js:56) (src/lib/boot.js:68)

### link / unlink

- `link` requires `tapestry.yaml` and an existing path. (src/commands/link.js:33-38)
- Reads the target's `pack.yaml`, records the name-to-absolute-path mapping in
  `tapestry-links.yaml`, and adds the pack to `tapestry-boot.yaml`. (src/commands/link.js:45-47)
- Appends `tapestry-links.yaml` to `.gitignore` if not already present.
  (src/commands/link.js:22-30)
- Warns if `active: false` is set in the linked pack's manifest. (src/commands/link.js:49-52)
- With `--skip-install`, skips dependency resolution and prints warnings for any missing deps
  instead. (src/commands/link.js:53-58)
- Without `--skip-install`, resolves and installs only the deps of the linked pack that are not
  already on disk. Rolls back all changes (link record, boot entry, any newly installed deps)
  on resolution failure. (src/commands/link.js:62-109)
- `unlink` removes the link record from `tapestry-links.yaml`, deletes any materialized copy
  from `packs/`, and removes the pack and its module from `tapestry-boot.yaml`.
  (src/commands/link.js:112-121)
- `link --list` (or `link` with no path) prints each linked name and absolute path, flagging
  missing paths with `(MISSING)`. (src/commands/link.js:123-133)

### Boot-order management

- `tapestry-boot.yaml` has two keys: `modules` (list of module class entries) and `packs`
  (map of pack name to `{ enabled }` flag). (src/lib/boot.js:9-14)
- `addPackageToBoot` writes the pack entry (always `enabled: true`) and, if the manifest has a
  `module.class`, appends a module entry then topologically sorts all modules.
  (src/lib/boot.js:22-41)
- `removePackageFromBoot` deletes the pack entry and all module entries for that package.
  (src/lib/boot.js:44-49)
- Topological sort honors `module.after` to order .NET classes that depend on each other.
  Cycles throw. (src/lib/boot.js:79-110)

### Dependency resolution

- Resolution is a breadth-first queue over `name@range` pairs, fetching package metadata from
  `/v1/packages/<name>`. (src/lib/semver-resolver.js:21-79)
- Dist-tag names (all lowercase letters) are resolved to a version range via `meta.dist_tags`
  before semver selection. (src/lib/semver-resolver.js:39-44)
- Picks the maximum semver version satisfying the range. Conflicts (same package, incompatible
  ranges from different requirers) throw with a descriptive message.
  (src/lib/semver-resolver.js:24-32) (src/lib/semver-resolver.js:46-51)
- Transitive dependencies are queued from the resolved manifest's `dependencies` field; peer
  dependencies emit a warning if not present but do not block resolution.
  (src/lib/semver-resolver.js:69-79)
- Package names must match `@scope/name` format; path traversal (`..`, `//`) is rejected at
  the HTTP layer. (src/lib/registry-client.js:7-16)

### pack (build tarball)

- Runs `validate` first; aborts on validation failure. (src/commands/pack.js:7)
- Builds a `.tgz` under a `package/` prefix in the current directory named
  `<shortName>-<version>.tgz`. (src/commands/pack.js:14) (src/lib/tarball-builder.js:16-26)
- Excludes `.git`, `node_modules`, `.DS_Store`, and `.tgz` files from the archive.
  (src/lib/tarball-builder.js:7-12)
- Prints the `sha256-<base64>` integrity hash of the output file.
  (src/commands/pack.js:18) (src/lib/tarball-builder.js:29-33)

### publish

- Runs `validate` first; aborts on validation failure. (src/commands/publish.js:17)
- In a GitHub Actions OIDC environment (both `ACTIONS_ID_TOKEN_REQUEST_URL` and
  `ACTIONS_ID_TOKEN_REQUEST_TOKEN` set), fetches a GitHub id-token and exchanges it for a
  scoped access token; also sets a `tag: stable` field on the form.
  (src/commands/publish.js:23-29)
- Otherwise, requires an existing authenticated session. (src/commands/publish.js:29)
- Builds the tarball to a temp file, computes integrity, POSTs a multipart form with the
  tarball and JSON metadata (manifest fields plus integrity) to `/v1/publish`.
  (src/commands/publish.js:36-64)
- Deletes the temp file in a `finally` block. (src/commands/publish.js:66-68)

### create pack (scaffold)

- Accepts `@scope/name` (used as-is) or a plain name (scope defaults to `@todo`).
  (src/commands/create-pack.js:8-18)
- Creates a subdirectory named after the short name in the current directory; throws if it
  already exists. (src/commands/create-pack.js:41-46)
- Writes the scaffold files from `generatePackFiles` and prints each one.
  (src/commands/create-pack.js:48-57) (src/scaffold/templates.js)

### list

- Reads the lock file and boot file; prints package name, resolved version, type (from the
  installed `pack.yaml`), and enabled/disabled status.
  (src/commands/list.js:17-48)
- If no packages are installed, prints "No packages installed." (src/commands/list.js:46-48)
- Also prints linked packs below the installed list, flagging missing paths.
  (src/commands/list.js:50-58)

## Rejected and Reverted

- None on record.

## Change Log

- None on record.
