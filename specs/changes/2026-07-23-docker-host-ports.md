---
release: 0.14.0
specs: [engine-management.md]
---

# Configurable Docker Host Ports

## Why

`start`'s docker mode hardcoded `-p 4000:4000 -p 4001:4001`, so every docker-mode
project published the same two host ports. That's fine for a single game on a
host, but a droplet running two engine instances side by side (e.g. a second
public game standing up alongside an existing private one) can't start the
second container at all -- `docker run` fails outright on the port collision,
and there was no way to configure around it without hand-editing the droplet.

## What

- `tapestry.yaml`'s `engine` object gains an optional `host_ports` field:
  `{ telnet?: number, websocket?: number }`. Either key may be set
  independently; either or both may be omitted.
- Docker mode now publishes `<host_ports.telnet>:4000` and
  `<host_ports.websocket>:4001` instead of the fixed `4000:4000`/`4001:4001`.
  The container's internal ports are unchanged -- only the host-side mapping is
  configurable, so `server.yaml`'s own `telnet_port`/`websocket_port` need no
  corresponding change.
- Omitting `host_ports` entirely (the existing behavior for every project
  written before this change) still publishes `4000:4000`/`4001:4001` -- fully
  backward compatible, no migration needed.
- Binary and source modes are unaffected: they never used docker port
  publishing, and already bind directly to whatever `server.yaml` configures.
