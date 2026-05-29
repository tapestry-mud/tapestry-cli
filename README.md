# @tapestry-mud/cli

CLI for the [Tapestry MUD engine](https://github.com/tapestry-mud/tapestry). Create game projects, install content packs, manage the engine, and publish packs to the registry.

## Install

```bash
npm install -g @tapestry-mud/cli
```

## Quick Start

Three commands from zero to a running game:

```bash
tapestry init
tapestry install
tapestry start
```

`tapestry init` scaffolds a project directory with a manifest, server config, and starter packs. `tapestry install` resolves dependencies from the registry and downloads them. `tapestry start` pulls the engine (if needed) and launches the server.

Connect with `telnet localhost 4000`.

**Requirements:** [Docker](https://www.docker.com/) must be installed and running. The default engine mode pulls a Docker image. Binary and source modes are also available (.NET runtime required for source mode -- coming soon).

## Admin Account

`tapestry init` generates a `server.yaml` with a seed admin block:

```yaml
admin:
  handle: TODO    # your admin character name
  password: changeme
```

Set your handle before starting the server. On first boot, the engine creates the admin account with the `admin` role. Log in and change your password immediately.

## Project Structure

After `tapestry init`, your project looks like this:

```
my-game/
  tapestry.yaml     # project manifest (dependencies, engine config)
  server.yaml       # engine config (port, admin seed, settings)
  packs/            # installed packs (managed by tapestry install)
  data/             # game data -- players, saves (persists across restarts)
  .tapestry-engine/ # engine artifacts (docker images, binaries, source)
  .gitignore        # excludes packs/, data/, .tapestry-engine/
```

## Commands

### Game Project

| Command | Description |
|---------|-------------|
| `tapestry init` | Scaffold a new game project from the starter preset |
| `tapestry install [pack]` | Install all dependencies, or add a specific pack |
| `tapestry uninstall [pack]` | Remove an installed pack |
| `tapestry update [pack]` | Update one or all packs to latest compatible versions |
| `tapestry list` | List installed packs with version and status |
| `tapestry enable [pack]` | Activate a disabled pack |
| `tapestry disable [pack]` | Disable a pack without removing files |
| `tapestry outdated` | Check for newer versions of installed packs |

### Engine

| Command | Description |
|---------|-------------|
| `tapestry start` | Launch the engine (auto-pulls Docker image if needed) |
| `tapestry stop` | Stop the running engine |
| `tapestry engine install` | Explicitly pull/download the engine artifact |
| `tapestry engine update` | Update the engine to the configured version |
| `tapestry engine info` | Show engine version, mode, and image/path |
| `tapestry engine versions` | List available engine channels from the registry |

### Registry

| Command | Description |
|---------|-------------|
| `tapestry search [query]` | Search the registry by keyword |
| `tapestry info [pack]` | Show pack metadata from the registry |
| `tapestry register` | Create a registry account |
| `tapestry login` | Authenticate with the registry (interactive password login) |
| `tapestry logout` | Revoke your session and remove `~/.tapestryrc` |
| `tapestry trust add <scope> <repo>` | Authorize a GitHub repo to publish to a scope via OIDC |
| `tapestry trust list` | List your trusted publishers |
| `tapestry trust rm <id>` | Remove a trusted publisher binding |
| `tapestry change-password` | Change your registry password |

### Pack Authoring

| Command | Description |
|---------|-------------|
| `tapestry create pack [name]` | Scaffold a new pack with annotated examples |
| `tapestry validate` | Validate the pack manifest and content files |
| `tapestry pack` | Build a tarball for local inspection |
| `tapestry publish` | Build and upload the pack to the registry |
| `tapestry unpublish [pack]` | Remove a pack from the registry |

### Admin

| Command | Description |
|---------|-------------|
| `tapestry dist-tag set [pack] [tag] [version]` | Set a dist-tag on a pack version |
| `tapestry dist-tag list [pack]` | List dist-tags for a pack |
| `tapestry preset set [name] [version] [channel] [packs]` | Update a registry preset |

## Publishing a Pack

### 1. Create an account

```bash
tapestry register
```

### 2. Scaffold and build your pack

```bash
tapestry create pack @yourscope/my-pack
cd my-pack
# edit areas, mobs, items, scripts...
tapestry validate
```

### 3. Publish

```bash
tapestry login
tapestry publish
```

The registry validates your manifest, bundles the content, and makes it available for `tapestry install`.

### 4. Tag a stable release (admin)

After verifying a published version works:

```bash
tapestry dist-tag set @yourscope/my-pack stable 0.1.0
```

Players using `tapestry init` with a preset that references your pack will resolve to the tagged version.

### CI Publishing (GitHub Actions, OIDC)

`tapestry publish` auto-detects the GitHub Actions OIDC environment and exchanges a short-lived
id-token for a registry access token — no stored secret, no `tapestry login` step. In your workflow:

```yaml
permissions:
  id-token: write   # required for OIDC
```

Authorize the repo once (scope owner or admin):

```bash
tapestry trust add yourscope your-org/your-repo
```

Then `tapestry publish` in CI just works. There is no `REGISTRY_CI_TOKEN` and no `--token` flag.

## Registry

Browse published packs at [tapestryengine.com/packages.html](https://tapestryengine.com/packages.html).

## Development

```bash
npm ci
npm test
```

## License

[AGPL-3.0](LICENSE)
