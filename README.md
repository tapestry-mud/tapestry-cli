# @tapestry-mud/cli

CLI for the [Tapestry MUD engine](https://github.com/tapestry-mud/tapestry). Create, manage, and publish content packs.

## Install

```bash
npm install -g @tapestry-mud/cli
```

## Commands

### Pack Development

| Command | Description |
|---------|-------------|
| `tapestry init` | Create a new pack project with scaffold |
| `tapestry create-pack [name]` | Generate a pack from a template |
| `tapestry validate` | Validate pack.yaml and content files |
| `tapestry pack` | Bundle a pack into a tarball for publishing |

### Pack Management

| Command | Description |
|---------|-------------|
| `tapestry install [pack]` | Install a pack from the registry |
| `tapestry uninstall [pack]` | Remove an installed pack |
| `tapestry update [pack]` | Update a pack to the latest version |
| `tapestry list` | List installed packs |
| `tapestry enable [pack]` | Enable a disabled pack |
| `tapestry disable [pack]` | Disable a pack without removing it |
| `tapestry outdated` | Check for newer versions of installed packs |
| `tapestry info [pack]` | Show pack metadata from the registry |
| `tapestry search [query]` | Search the registry for packs |

### Engine

| Command | Description |
|---------|-------------|
| `tapestry start` | Start the Tapestry server |
| `tapestry stop` | Stop the Tapestry server |
| `tapestry engine` | Show engine version and status |

### Registry Account

| Command | Description |
|---------|-------------|
| `tapestry register` | Create a registry account |
| `tapestry login` | Log in to the registry |
| `tapestry publish` | Publish a pack to the registry |
| `tapestry unpublish [pack]` | Remove a pack from the registry |
| `tapestry change-password` | Change your registry password |

## Registry

Packs are published to [registry.tapestryengine.com](https://registry.tapestryengine.com).

## Development

```bash
npm ci
npm test
```

## License

[AGPL-3.0](LICENSE)
