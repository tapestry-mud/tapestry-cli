# engine-management

Capability spec for acquiring, configuring, running, and stopping the Tapestry engine.

## Overview

engine-management covers the lifecycle of the Tapestry engine process from the CLI's
perspective: reading the engine configuration from `tapestry.yaml`, fetching or building the
engine artifact, starting it, and stopping it. Three launch modes are supported: `docker`
(recommended; pulls and runs a container image), `binary` (downloads a pre-built platform
binary from GitHub Releases), and `source` (git-clones the engine and runs it via
`dotnet run`). Named channels (`stable`, `nightly`) resolve to concrete versions via the
registry for the docker mode.

Commands: `engine install`, `engine update`, `engine info`, `engine versions`, `start`, `stop`.

## Behavior

### Configuration

Engine configuration is read from the `engine` key in `tapestry.yaml`. The key must be an
object (not a plain string, which is the pack manifest format). Required fields are
`engine.version` and `engine.mode`; `mode` must be one of `docker`, `binary`, or `source`.
(src/lib/engine-manager.js:249-278)

Derived values from `readEngineConfig`: (src/lib/engine-manager.js:248-278)

- `image` defaults to `ghcr.io/tapestry-mud/tapestry` if not specified.
- `network` is null if not specified.
- `envFile` is null if not specified (`engine.env_file`).
- `installDir` is always `<cwd>/.tapestry-engine`.
- `projectName` is the manifest `name` lowercased and with non-alphanumeric/hyphen characters
  replaced by `-`.

### Channel resolution (docker mode only)

Channel names `stable` and `nightly` are the two recognized named channels.
(src/lib/engine-manager.js:6)

When the configured version is a named channel, `resolveDockerTag` fetches
`<registry>/v1/engine-channels/<channel>` and returns the `docker_tag` field.
(src/lib/engine-manager.js:14-35)

- If the registry is unreachable, the channel name is used as the tag directly with a warning.
  (src/lib/engine-manager.js:19-22)
- If the registry returns 404, throws with a hint to run `engine versions`.
  (src/lib/engine-manager.js:23-27)
- If the version string is not a named channel, it is used as the Docker tag directly.
  (src/lib/engine-manager.js:13-14)

### engine install

- **docker mode**: Calls `docker pull <image>:<version>`. If the tagged pull fails, falls back
  to `docker pull <image>:latest` and re-tags to the requested version.
  (src/lib/engine-manager.js:44-59)
- **binary mode**: Determines the platform (`linux`, `osx`, or `windows`), downloads the
  engine tarball from
  `https://github.com/tapestry-mud/tapestry/releases/download/v<version>/tapestry-<platform>.tar.gz`
  using `curl`, extracts it to `.tapestry-engine/binary/<version>/`, then deletes the
  downloaded tarball. (src/lib/engine-manager.js:124-151)
- **source mode**: `git clone`s `https://github.com/tapestry-mud/tapestry.git` into
  `.tapestry-engine/source/`. Throws if the source directory already exists (use
  `engine update` instead). (src/lib/engine-manager.js:180-194)

### engine update

- **docker mode**: Same pull logic as install (re-pulls the tag).
  (src/lib/engine-manager.js:294-298)
- **binary mode**: Re-runs `binaryInstall` for the configured version.
  (src/lib/engine-manager.js:299-300)
- **source mode**: Runs `git pull` inside `.tapestry-engine/source/`; throws if the source
  directory is absent. (src/lib/engine-manager.js:195-207)

### engine info

Prints `Mode`, `Version`, and either `Image` (docker) or `Path` and `Status` (binary/source).
(src/commands/engine.js:13-23)

For binary and source modes, `installed` is true if the expected directory exists on disk.
(src/lib/engine-manager.js:174) (src/lib/engine-manager.js:226)

### engine versions

Fetches `/v1/engine-channels` from the registry and prints a table of Channel, Version, and
Updated columns. Prints "No engine channels registered." if the list is empty.
(src/commands/engine-versions.js:7-31)

### start

- Requires `packs/` directory and `server.yaml` in the project root; throws otherwise.
  (src/lib/engine-manager.js:321-327)
- Creates `data/` directory if absent. (src/lib/engine-manager.js:328)
- **docker mode**: Calls `docker rm -f <containerName>` to clear any stale container, then
  `docker run --detach` with port mappings `-p 4000:4000 -p 4001:4001`, volume mounts for
  `packs/`, `server.yaml`, and `data/`, optional `--network` and `--env-file`, and any link
  mounts from `dockerLinkMounts`. (src/lib/engine-manager.js:69-99)
- **binary mode**: Materializes links into `packs/`, spawns the engine binary detached, and
  writes the PID to `.tapestry.pid`. (src/lib/engine-manager.js:154-171)
  (src/lib/process-tracker.js:8-10)
- **source mode**: Materializes links, runs `dotnet run` in `.tapestry-engine/source/` with
  `--packs` and `--config` arguments, detached, and writes the PID to `.tapestry.pid`.
  (src/lib/engine-manager.js:208-222) (src/lib/process-tracker.js:8-10)
- **docker mode with `engine.env_file`**: Resolves the path relative to the project root and
  throws if the file does not exist before starting. (src/lib/engine-manager.js:330-338)
- Container name for docker mode is `tapestry-<projectName>`. (src/lib/engine-manager.js:70)
- Prints "Engine started. Container: <name>" (docker) or "Engine started (PID <pid>)"
  (binary/source) and the telnet/websocket addresses. (src/lib/engine-manager.js:96-99)
  (src/lib/engine-manager.js:168-171)

### stop

- **docker mode**: Runs `docker stop <containerName>` then `docker rm <containerName>`.
  Throws if either command fails. (src/lib/engine-manager.js:101-112)
- **binary/source mode**: Reads the PID from `.tapestry.pid`, sends `SIGTERM`, and clears the
  file. If the process is already gone when `SIGTERM` is sent, the error is swallowed and the
  PID file is still cleared. Throws if no PID file is found.
  (src/lib/engine-manager.js:232-243) (src/lib/process-tracker.js:14-20)
  (src/lib/process-tracker.js:22-27)

### Process tracker

- `writePid` writes the PID as a string to `<cwd>/.tapestry.pid`.
  (src/lib/process-tracker.js:8-10)
- `readPid` reads and parses the PID; returns null if the file is absent or the value is not a
  positive integer. (src/lib/process-tracker.js:13-20)
- `clearPid` deletes the file if present; no-op otherwise.
  (src/lib/process-tracker.js:22-27)

## Rejected and Reverted

- None on record.

## Change Log

- None on record.
