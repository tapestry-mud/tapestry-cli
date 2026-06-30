---
release: 0.12.0
specs: [harvest.md]
---

# Harvest Registry Sink

## Why

Harvest could promote authored area content to a portable `.tgz` (file sink) or
into a linked pack git repo (git sink), but an operator running a no-git
single-box server had no way to publish a harvested area straight to the
registry. Their pack is their own source of truth, yet the only registry path
ran through CI on a repo machine they did not have. The gap was a publish sink
that runs where the registry token already lives.

## What

- New `--sink registry` value on `harvest`: render the area, tar the pack, and
  POST to the registry's `/v1/publish`. Run on the machine where the token lives
  (the operator's box or a no-git server).
- A source-of-truth gate refuses registry-direct publishing when the linked pack
  is a git repo, and points the operator at the file-sink + repo + CI workflow
  instead (never two sources of truth). A non-git owned pack and the no-linked-pack
  hobbyist case are both allowed.
- Owned (non-git linked pack) mirrors the git sink: it renders INTO the real pack
  directory so content accumulates across repeated harvests, bumps `pack.yaml`
  (patch by default; `--minor` / `--major`), then tars and POSTs. A write-permission
  pre-check fails loudly before any render rather than half-writing on EACCES.
- Hobbyist (no linked pack) mirrors the file sink: synthesize a manifest at 0.1.0
  into a temp dir, render, tar, POST; no persistent bump. A second publish at 0.1.0
  is rejected by the registry, the intended nudge to link a real pack.
- Token auth via `requireAccess()` only; no OIDC detection (the CI/OIDC path stays
  the git sink's job). Side-cars are removed only after a successful publish;
  `--keep-sidecars` preserves them. `--name` and `--minor` / `--major` are rescoped
  to include the registry sink; there is no `--out` for this sink.
- This release also lands harvest content-carry work that had sat on master since
  the unreleased 0.11.0: `renderArea` now carries oracle table side-cars
  (`places-oracle.yaml`, `*-oracle-table.yaml`) and mob/item instance files
  (`mobs/*.yaml`, `items/*.yaml`) into the target pack, and the content globs gain
  `oracle_tables`, `places_oracle`, `mobs`, and `items`.
