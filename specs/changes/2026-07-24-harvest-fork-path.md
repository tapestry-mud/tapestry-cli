---
release: 0.13.0
specs: [harvest.md]
---

# Harvest Fork Path

## Why

Harvest could promote authored content into a pack the operator owns (the git,
file, and registry sinks), but content living in a namespace the operator does
NOT own -- an official or foreign pack such as `@tapestry/core` -- had nowhere
to go. World-state already classified such an area as a Fork, yet harvest either
threw or silently synthesized a manifest for the foreign namespace. The gap was
a fork path: re-key not-owned content into the operator's own pack, record where
it came from, and declare the dependency on the origin.

## What

- `tapestry harvest <ns:area> --name @scope/fork-name` on an area whose namespace
  scope is not the operator's now forks it. Every `originNamespace:` id under the
  area tree is re-keyed to the fork namespace, and the fork `pack.yaml` records a
  provenance line (`description: derivative of @origin/pack@<version>`) plus a
  static origin dependency (`dependencies: { "@origin/pack": "^<major>.<minor>.0" }`,
  the patch zeroed to the caret-of-minor convention).
- Fork detection is ownership-by-scope, decoded from the operator's registry
  session (durable across `link` / `unlink`, never read from the links file), not
  link-presence. An area is owned iff its namespace equals the operator scope or
  is prefixed by `<scope>-`; otherwise it forks. A hyphenated handle (`my-org`)
  owns `my-org-core` correctly -- the scope is never extracted by splitting the
  namespace on its first dash. When not logged in, an area is never a fork and the
  previously shipped dispatch is preserved exactly.
- `--name @scope/fork-name` is required for a fork; absent it, harvest exits with
  the convention hint (`@<scope>/<origin-package>-fork`) and writes nothing. A
  `--name` that is not a valid `@scope/name` is rejected rather than degrading to
  an `undefined-<version>.tgz` output.
- The origin version is read from the linked origin pack (harvest errors, with a
  link hint, when the origin is not linked). The re-key is a prefix rewrite over
  every string value under `areas/`, so prose that merely mentions the origin
  namespace is left intact; making the re-key aware of cross-pack references to
  un-forked origin content is deferred to a later slice.
- All three sinks accept a fork: the file sink tars the built fork directory; the
  registry sink tars and POSTs, with the source-of-truth gate refusing a fork
  whose pack is a linked git repo (use the git sink instead); the git sink renders
  into the linked fork repo, bumps, and commits, and requires the fork pack to be a
  linked git repo. Side-cars are removed after a successful sink unless
  `--keep-sidecars` is given.
- The fork manifest carries `author` (the operator's scope) and an inherited
  `license` -- the origin pack's license, falling back to MIT only when the origin
  declares none -- so the fork validates like an owned harvest. A fork is a
  derivative, so a fork of AGPL-licensed content stays AGPL rather than defaulting
  to the owned path's MIT.
