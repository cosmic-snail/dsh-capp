# Development checks, git hook and CI

Every check here reports and exits non-zero on failure. None of them fixes files, installs tools for you, or runs DSH, NX or Mastercam. Acceptance happens only through the gates in [acceptance/](acceptance/README.md).

You need Node 22 LTS and git. pnpm 10.34.5 is needed once the S0 workspace exists (spec §1.2). The docs check and the hook have no dependencies, so they work on a fresh clone before `pnpm install`.

## Check groups

```sh
node scripts/check.mjs                 # same as: docs
node scripts/check.mjs docs            # docs checker + its self-tests
node scripts/check.mjs types test      # root `pnpm run typecheck`, `pnpm run test`
node scripts/check.mjs pack            # root `pnpm run build`, then `pnpm run pack`
node scripts/check.mjs install-hooks   # once per clone
```

Groups run in the order given and stop at the first failure. Each command is printed with its exit code. `types`, `test` and `pack` exit 2 with a clear message until S0 adds `pnpm-workspace.yaml`. S0 must define the root scripts `typecheck`, `test`, `build` and `pack` that these groups call ([spec §3](spec.md#3-directory-topology-and-module-boundaries)). The groups only call them, so the scripts stay the single definition.

## Docs check

[`scripts/check-docs.mjs`](../scripts/check-docs.mjs) scans every `*.md` in the repo except `node_modules`, build output and worktrees. It enforces the mechanical parts of [docs/AGENTS](AGENTS.md):

- **Links:** relative link and image targets and reference definitions must exist inside the repo. `file:` URLs and drive-letter paths are rejected. Links inside code blocks and inline code are ignored. Anchors (`#…`), external URLs and HTML `<a>` tags aren't checked, and neither are links whose text has nested brackets.
- **Machine facts:** personal home paths (`/Users/<name>/`, `/home/<name>/`, `C:\Users\<name>\`), agent worktree paths and private IPv4 addresses (10/8, 172.16/12, 192.168/16) are rejected anywhere, code included. The `/Users/...` placeholder and example directories such as `C:\capp-assets\…` pass.
- **Reachability:** every page under `docs/` outside `acceptance/`, `experiments/` and `research/` must be reachable by links from the root README, root AGENTS or docs/README. Archive pages are endpoints, so they don't make other pages reachable.
- **No dated narrative in current pages:** a line in a current page (docs outside the archive folders, root README, root AGENTS) that starts with a `YYYY-MM-DD` date fails.
- **Notes:** files in `.agents/notes/` live in `proposed/`, `implemented/` or `rejected/`, are named `YYYY-MM-DD-topic.md`, have exactly one `Status:` equal to their folder, have `Date:` and `Baseline:`, and have the template's five `##` sections. Whether the rationale is worth keeping is a human judgment.
- **Development skills:** `.agents/skills/<name>/SKILL.md` has frontmatter with `name: <name>` and a `description`. Product skills under `packages/*/skills/` are left to the owning plugin and its gate.

[`check-docs.test.mjs`](../scripts/check-docs.test.mjs) runs with node's built-in test runner and covers each rule on throwaway trees. The asset boundary isn't enforced here: `.gitignore` plus review is the only asset guard (spec G8). Passing the docs check doesn't make the facts in the docs right.

## Git hook

`node scripts/check.mjs install-hooks` sets `core.hooksPath=.githooks` for the clone and all its worktrees. If `core.hooksPath` is already set to something else, it reports that and changes nothing.

[`.githooks/pre-commit`](../.githooks/pre-commit) pipes the **staged** copy of [`scripts/check-staged.mjs`](../scripts/check-staged.mjs) into node. That script:

1. Fails if the index has unresolved conflicts.
2. Runs `git diff --cached --check` (trailing whitespace, conflict markers).
3. Exports the complete index to a temporary directory with `git checkout-index` and runs the staged docs checker against it, then deletes the snapshot.

So a broken link staged while the working copy is fixed still fails, and an unstaged new target doesn't count. Fix in the working tree, re-stage and commit again. The hook doesn't run typecheck or unit tests, because the snapshot has no `node_modules`; run `types test` yourself before pushing. It's a consistency check, not a tamper-proof boundary: anyone can skip it with `--no-verify`. If you do, say why in the PR. CI runs the same docs check regardless.

## CI

[Quality](../.github/workflows/quality.yml) runs on pull requests, pushes to `main` and manual dispatch, on **GitHub-hosted runners only** with read-only repository permissions. The repo is public, so CI never uses a self-hosted runner and never receives asset or Drive credentials ([decision note](../.agents/notes/implemented/2026-11-08-hosted-ci-public-repo.md)).

| Job | Runner | What it runs |
|---|---|---|
| Docs | Ubuntu | `node scripts/check.mjs docs`; on PRs also `git diff --check` over the PR's changes |
| Code | Ubuntu and Windows | `pnpm install --frozen-lockfile`, then `check.mjs types test`. Windows catches path and line-ending bugs in pure modules such as `inside()` |
| Pack | Ubuntu | `check.mjs pack`, then uploads `dist/*.tgz` as a 14-day artifact. The `.tgz` files hold code only |

Before S0 there's no workspace, so Code and Pack skip their steps and say so in the job summary. That is a visible skip, not a pass.

A green run proves only these mechanical checks. It isn't a gate (except G1, which is defined as `pnpm test` green), and it says nothing about the Harness loading a plugin, NX output, Mastercam or NC.

Which checks are required to merge is set in the branch protection or ruleset of `main`, not in this file. Check it with `gh api repos/cosmic-snail/dsh-capp/rulesets` or `gh api repos/cosmic-snail/dsh-capp/branches/main/protection`.

## Line endings

[`.gitattributes`](../.gitattributes) stores text with LF, so the hook script and fixtures behave the same on Windows and macOS. `.cmd`/`.bat` files keep CRLF. [`.editorconfig`](../.editorconfig) matches the house style in spec §6.1.
