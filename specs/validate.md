# validate

Capability spec for offline pack manifest validation.

## Overview

`tapestry validate` reads `pack.yaml` from the current directory and checks it against the
Zod schema that defines a valid pack manifest. No network calls are made; no registry is
consulted. The command is also called internally by `pack` and `publish` before they proceed.

## Behavior

- Looks for `pack.yaml` (the constant `PACK_MANIFEST`) in the current working directory.
  (src/lib/manifest.js:3) (src/commands/validate.js:10-11)
- If `pack.yaml` is absent but `tapestry.yaml` is present, throws a specific error explaining
  that the file found is a server manifest, not a pack manifest.
  (src/commands/validate.js:13-20)
- If neither file is present, throws "No pack.yaml found in current directory".
  (src/commands/validate.js:21)
- Runs `validatePackageManifest` which calls Zod's `safeParse` on the YAML-parsed data.
  (src/commands/validate.js:25-26) (src/schema/manifest.js:58-60)
- On success, prints "OK  <name> v<version>" with two leading spaces. (src/commands/validate.js:38-39)
- On failure, iterates Zod issues and prints each as "  error: <fieldPath> - <message>".
  The field path is the dot-joined `issue.path`, or "root" if the path is empty.
  (src/commands/validate.js:29-36)
- For an `engine` field that is an object (the server manifest format) in a document being
  validated as a pack manifest, appends a hint that `engine` must be a version constraint
  string in pack manifests. (src/commands/validate.js:31-35)
- Throws with a count of validation errors so callers (`pack`, `publish`) can abort.
  (src/commands/validate.js:37)

### Pack manifest schema

Required fields (src/schema/manifest.js:7-39):

- `name` -- string matching `@scope/package-name` (lowercase letters, digits, hyphens only).
- `version` -- non-empty string (no semver enforcement at this layer).
- `type` -- one of `core`, `module`, `world`.
- `display_name` -- non-empty string.
- `description` -- non-empty string.
- `author` -- non-empty string.
- `license` -- non-empty string.
- `engine` -- non-empty string (a version constraint, e.g. `>=0.0.1`).
- `validation` -- one of `strict`, `lenient`.

Optional fields (src/schema/manifest.js:17-38):

- `dependencies` -- record of package name to version range string.
- `peerDependencies` -- record of package name to version range string.
- `provides` -- array of strings.
- `tags` -- string.
- `module` -- object with required `assembly`, `class`, `implements`; optional `after`.
- `content` -- record of glob key to glob pattern string.
- `client` -- object with `manifest`, `assets`, `min_client_version`.
- `meta` -- object with optional `commands` (string array), `properties` (number), `keywords`
  (string array).
- `private` -- boolean.

## Rejected and Reverted

- None on record.

## Change Log

- None on record.
