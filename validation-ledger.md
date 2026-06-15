# Validation ledger

Adjudication record for `specs/` capability drafts. One line per finding:
`date | file | finding | verdict (fixed / below-bar / not-real) | why`.

Read before judging; never re-report an adjudicated finding as new.

## Findings

2026-06-13 | validate.md | All 10 anchors verified; four required sections present | not-real | Pass 1: no issues found.
2026-06-13 | registry-auth.md | All 30 anchors verified (paths, 0o600 mode, 60s skew, OIDC audience, trust endpoints) | not-real | Pass 1: no issues found.
2026-06-13 | engine-management.md | All 30 anchors verified (image default, ports 4000/4001, .tapestry.pid, channels, pull-fallback) | not-real | Pass 1: no issues found.
2026-06-13 | harvest.md | "computeAreaStates iterates data/areas/ alphabetically" -- code iterates readdir order (l.32) and sorts the OUTPUT (l.76) | below-bar | Observable behavior (status prints alphabetically) is correct; cited range 26-77 covers the sort. "iterates" is imprecise mechanism wording, not a wrong behavior claim. Adjudicator re-verified.
2026-06-13 | harvest.md | --minor/--major anchor bin/tapestry.js:406-408 vs actual ~408-409 | below-bar | Off by ~2 lines; cited region clearly contains the flag behavior.
2026-06-13 | harvest.md | file-sink completion message anchor :55-56 vs print on l.55 | below-bar | Off by 1 line; message present at cited region.
2026-06-13 | harvest.md | Quoted completion message "This .tgz is a portable, installable pack" is truncated vs full string | below-bar | Spec paraphrases the lead of the message; not presented as the complete literal. Core claim accurate.
2026-06-13 | pack-lifecycle.md | enable.js anchor :4-9 vs tapestry.yaml check at ~8-10 | below-bar | Off by 1-2 lines; require stmts at 4-5, behavior present in cited region.
2026-06-13 | pack-lifecycle.md | link.js anchor :33-38 for "requires tapestry.yaml and existing path" | below-bar | requireProject at l.34, path check 35-38; behavior present and correct in cited range.
2026-06-13 | pack-lifecycle.md | UNVERIFIED marker (update.js:39 passes no token, install does) | below-bar | Code fact verified correct: update.js:39 calls resolve(deps,url) w/o token; install passes token. Uncertainty is about the IMPACT (private-pack updates), honestly marked. No action; leave marker for owner or resolve in a draft if desired.
2026-06-13 | engine-management.md | start bullet quotes "Engine started (PID <pid>)" for binary/source; source actually prints "Engine started via dotnet run (PID <pid>)" (engine-manager.js:220) | below-bar | Bullet's cited anchors (96-99 docker, 168-171 binary) support the quoted strings exactly; source's extra "via dotnet run" is an over-generalization of the literal, not a wrong behavior claim. Pass 2 adversarial.
2026-06-13 | pack-lifecycle.md | install package-arg bullet (install.js:92-106) claimed entry is "pinned at ^version" for BOTH @scope/name and @scope/name@range; code only re-pins when !rawRange (install.js:101), explicit range kept as-is | fixed | Pass 2 BLOCKER. Routed to draft fix; bullet rewritten to describe both cases with anchors install.js:92-105 + 101-103. Re-graded by adjudicator and a fresh skeptic: correct. Re-lint OK (file 61->62 anchor lines).

## Pass log

- Pass 1 (per-file anchor walk, 5 agents): 0 blockers. 10 below-bar logged.
- Pass 2 (adversarial refutation, 2 agents): 1 new blocker (install.js pinning) -> fixed; 1 below-bar (engine start message).
- Post-fix Pass A (adjudicator re-grade of corrected bullet): clean.
- Post-fix Pass B (mechanical re-lint + fresh skeptic): clean.
- Stopping rule met: two consecutive passes, zero new blockers. Corpus validated 2026-06-13.
