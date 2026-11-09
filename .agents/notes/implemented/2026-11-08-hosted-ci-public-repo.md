# Hosted CI and a zero-dependency hook for a public repo

Status: implemented
Date: 2026-11-08
Baseline: branch `chore/engineering-pipeline` (based on main `32a96ad`), not merged

## Problem

The development pipeline is adapted from CAPPtron-core, whose Quality workflow runs every job on self-hosted Windows runners on a personal machine, gives the main build Drive and SSH credentials, gates on exact JUnit test counts, and installs its git hook through Python pre-commit. [development.md](../../../docs/development.md) says what dsh-capp runs instead, but not why it deliberately does less.

## Alternatives

- **Reuse the self-hosted Windows runner.** It would let CI touch NX and Mastercam. Rejected: dsh-capp is public, and any fork PR could run code on a machine that holds proprietary assets and vendor licenses. CAPPtron-core's own CI note already says that going public requires re-evaluating that boundary. The spec also makes gates manual on the Windows machine (§6.5, §7), so CI wouldn't replace them anyway.
- **Fetch private assets in CI for a fuller build.** Rejected: it puts Drive credentials in a public repo's workflow (design §8) and nothing in the MVP's CI needs the assets.
- **Exact test-count checks and coverage manifests** as in CAPPtron-core. Rejected for now: they guard against a split between two jobs on one shared machine, a problem hosted runners don't have, and they're the kind of layered validation design principle 1 warns against.
- **pre-commit (Python) or husky (npm) for the hook.** Rejected: the first adds Python to a Node repo; the second needs `pnpm install` before the hook works, and the S0 workspace doesn't exist yet. `core.hooksPath` plus a staged-index snapshot keeps CAPPtron-core's useful property (check what's staged, not the working copy) with only git and node.
- **A markdown-it based link checker** as in CAPPtron-core. Rejected for now: it would need node_modules inside the exported index snapshot. A small regex extractor covers the links this repo writes; its limits are listed in development.md.

## Decision

Quality runs only on GitHub-hosted Ubuntu and Windows runners with `contents: read` and no secrets. Docs runs from day one; Code and Pack skip, visibly in the job summary, until `pnpm-workspace.yaml` exists. The git hook is `.githooks/pre-commit`, installed by `node scripts/check.mjs install-hooks`, and runs the staged docs check on an index snapshot. Acceptance stays in the manual gates.

## Cost and limits

CI never proves anything about DSH, NX, Mastercam or NC; that's carried entirely by gate records, so a skipped gate is easy to miss in review. The PR template asks for it explicitly. The regex link checker can miss links with nested brackets and doesn't check anchors. If the repo goes private, or CI ever needs vendor tools, revisit the self-hosted option with an isolated runner and no asset access. If the hook later needs typecheck, it needs a different approach than an index snapshot without node_modules.

## Evidence and gaps

Local: `node scripts/check.mjs docs` and its nine self-tests pass on Linux with Node 22; the hook was exercised against a staged broken link and a staged fix. CI: Quality run 42551933031 (pull_request, commit `dc94e32`, PR #2) passed Docs, Code on Ubuntu and Windows, and Pack. Gap: Code and Pack only exercised their skip path because there is no workspace before S0, so neither runner has built or tested TypeScript yet. Re-check both legs in the S0 PR.
