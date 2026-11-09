# Development checks, git hook and CI

Every check here reports and exits non-zero on failure. None of them fixes files, installs tools for you, or runs DSH Desktop, NX or Mastercam. Acceptance happens only through the gates in [acceptance/](acceptance/README.md); driving the Harness on the Windows machine from the command line is covered in [Harness from the command line](#harness-from-the-command-line).

You need Node 22 LTS (22.13 or newer) and git. pnpm 10.34.5 is needed for every group (spec §1.2). The docs check and the hook have no dependencies, so they work on a fresh clone before `pnpm install`.

## Check groups

```sh
node scripts/check.mjs                 # same as: docs
node scripts/check.mjs docs            # docs checker + its self-tests
node scripts/check.mjs lint            # root `pnpm run lint`
node scripts/check.mjs types test      # root `pnpm run typecheck`, `pnpm run test`
node scripts/check.mjs pack            # root `pnpm run build`, then `pnpm run pack`
node scripts/check.mjs install-hooks   # once per clone
```

Groups run in the order given and stop at the first failure. Each command is printed with its exit code. `lint` calls the root `lint` script; `types`, `test` and `pack` call the root scripts `typecheck`, `test`, `build` and `pack` ([spec §3](spec.md#3-directory-topology-and-module-boundaries)). The groups only call them, so the scripts stay the single definition. If `pnpm-workspace.yaml` is missing, `types`, `test` and `pack` exit 2 with a clear message instead of running.

## Docs check

[`scripts/check-docs.mjs`](../scripts/check-docs.mjs) scans every `*.md` in the repo except `node_modules`, build output and worktrees. It enforces the mechanical parts of [docs/AGENTS](AGENTS.md):

- **Links:** relative link and image targets and reference definitions must exist inside the repo. `file:` URLs and drive-letter paths are rejected. Links inside code blocks and inline code are ignored. Anchors (`#…`), external URLs and HTML `<a>` tags aren't checked, and neither are links whose text has nested brackets.
- **Machine facts:** personal home paths (`/Users/<name>/`, `/home/<name>/`, `C:\Users\<name>\`), agent worktree paths and private IPv4 addresses (10/8, 172.16/12, 192.168/16) are rejected anywhere, code included. The `/Users/...` placeholder and example directories such as `C:\capp-assets\…` pass.
- **Reachability:** every page under `docs/` outside `acceptance/`, `experiments/` and `research/` must be reachable by links from the root README, root AGENTS or docs/README. Archive pages are endpoints, so they don't make other pages reachable.
- **No dated narrative in current pages:** a line in a current page (docs outside the archive folders, root README, root AGENTS) that starts with a `YYYY-MM-DD` date fails.
- **Notes:** files in `.agents/notes/` live in `proposed/`, `implemented/` or `rejected/`, are named `YYYY-MM-DD-topic.md`, have exactly one `Status:` equal to their folder, have `Date:` and `Baseline:`, and have the template's five `##` sections. Whether the rationale is worth keeping is a human judgment.
- **Development skills:** `.agents/skills/<name>/SKILL.md` has frontmatter with `name: <name>` and a `description`. Product skills under `packages/*/skills/` are left to the owning plugin and its gate.

[`check-docs.test.mjs`](../scripts/check-docs.test.mjs) runs with node's built-in test runner and covers each rule on throwaway trees. The asset boundary isn't enforced here: `.gitignore` plus review is the only asset guard (spec G8). Passing the docs check doesn't make the facts in the docs right.

## Lint

`node scripts/check.mjs lint` runs `pnpm run lint`, which is ESLint on every JS and TS file (spec §1.2). Install first with `pnpm install`. It enforces ESLint recommended plus the mechanical house style from spec §6.1: single quotes, no semicolons. Indent, naming, and `tsc --noEmit` stay outside this check. There is no formatter, and the command does not fix files.

The git hook does not run lint. The index snapshot has no `node_modules`.

## Git hook

`node scripts/check.mjs install-hooks` sets `core.hooksPath=.githooks` for the clone and all its worktrees. If `core.hooksPath` is already set to something else, it reports that and changes nothing.

[`.githooks/pre-commit`](../.githooks/pre-commit) pipes the **staged** copy of [`scripts/check-staged.mjs`](../scripts/check-staged.mjs) into node. That script:

1. Fails if the index has unresolved conflicts.
2. Runs `git diff --cached --check` (trailing whitespace, conflict markers).
3. Exports the complete index to a temporary directory with `git checkout-index` and runs the staged docs checker against it, then deletes the snapshot.

So a broken link staged while the working copy is fixed still fails, and an unstaged new target doesn't count. Fix in the working tree, re-stage and commit again. The hook doesn't run lint, typecheck, or unit tests, because the snapshot has no `node_modules`; run `lint` and, once the workspace exists, `types test` yourself before pushing. It's a consistency check, not a tamper-proof boundary: anyone can skip it with `--no-verify`. If you do, say why in the PR. CI runs the docs check and lint regardless.

## CI

[Quality](../.github/workflows/quality.yml) runs on pull requests, pushes to `main` and manual dispatch, on **GitHub-hosted runners only** with read-only repository permissions. The repo is public, so CI never uses a self-hosted runner and never receives asset or Drive credentials ([decision note](../.agents/notes/implemented/2026-11-08-hosted-ci-public-repo.md)).

| Job | Runner | What it runs |
|---|---|---|
| Docs | Ubuntu | `node scripts/check.mjs docs`; on PRs also `git diff --check` over the PR's changes |
| Lint | Ubuntu | `pnpm install --frozen-lockfile`, then `check.mjs lint` |
| Code | Ubuntu and Windows | `pnpm install --frozen-lockfile`, then `check.mjs types test`. Windows catches path and line-ending bugs in pure modules such as `inside()` |
| Pack | Ubuntu | `check.mjs pack`, then uploads `dist/*.tgz` as a 14-day artifact. The `.tgz` files hold code only |

The Code and Pack jobs detect `pnpm-workspace.yaml` and skip their steps with a visible note in the job summary when it's absent; a skip is not a pass.

A green run proves only these mechanical checks. It isn't a gate (except G1, which is defined as `pnpm test` green), and it says nothing about the Harness loading a plugin, NX output, Mastercam or NC.

Which checks are required to merge is set in the branch protection or ruleset of `main`, not in this file. Check it with `gh api repos/cosmic-snail/dsh-capp/rulesets` or `gh api repos/cosmic-snail/dsh-capp/branches/main/protection`.

## Harness from the command line

On the Windows machine, `scripts/dsh-cli.cmd` runs the Harness that DSH Desktop v0.13.2 bundles — Electron in Node mode, the same way Desktop launches it — against a development `DSH_HOME`, separate from Desktop's own profile. `DSH_HOME` must be set first; the script refuses to run without it.

```cmd
dsh-cli plugin --profile headless add <absolute .tgz>
dsh-cli --profile headless --dump-config
dsh-cli --profile headless --json "<task>"
dsh-cli --profile tui
```

`--json` prints NDJSON run events — the evidence for tool calls. The model comes from `DEEPSEEK_API_KEY` in the user environment and the profile's configured default; each gate run records the model id it used. The `headless` and `tui` profiles have no `connection` service, so workbench HTTP routes and the panel exist only in `web` / DSH Desktop. Nothing here runs in CI.

## Line endings

[`.gitattributes`](../.gitattributes) stores text with LF, so the hook script and fixtures behave the same on Windows and macOS. `.cmd`/`.bat` files keep CRLF. [`.editorconfig`](../.editorconfig) matches the house style in spec §6.1.
