# Agent rules for dsh-capp

## Starting a task

- Check `git status --short --branch`, the current commit and the target base first. Keep any uncommitted changes you find. Use a separate worktree or branch per task, and don't conclude a feature is missing because an old checkout lacks a file.
- Read [docs/status.md](docs/status.md) for what is actually merged and which gates have passed, then use [docs/README.md](docs/README.md) to find the contract you need. Something listed in the spec's directory tree or a plan is not proof it exists.
- [docs/spec.md](docs/spec.md) is the source of truth for engineering decisions (stack, module boundaries, interfaces, guardrails, gates). [docs/design.md](docs/design.md) is the source of truth for product intent and file formats. Update the owning doc in the same change when a contract changes. Read [docs/AGENTS.md](docs/AGENTS.md) before editing docs.

## Hard boundaries

- **Never commit assets or secrets** ([docs/assets.md](docs/assets.md)): no STEP/MCAM/PST/NC files, NX scripts, SDK files, machine names or addresses, keys, logs, screenshots or session exports. Refer to assets by their logical id from `assets/manifest.example.json`. `.gitignore` plus review is the only asset guard (spec G8), so look at `git status` before every commit.
- Keep validation minimal: only the three hard checks in design §2 and the guardrails in spec §6.3. Prefer a warning over a block and a rerun over recovery logic. Don't build anything on the spec §6.4 anti-pattern list.
- Plugins follow the DSH plugin and workbench standard in the host repo (`dataelement/dsh-desktop`, `docs/workbench-standard.*.md`). No CAPP code goes into the host; an unavoidable host change goes into a fork and is recorded in `docs/host-patches.md`.
- CAPPtron-core is reference only. Don't copy its code.
- Approving a plan and approving NC are human panel actions. Never add a tool, script or test helper that writes `approval.json` or `nc-review.json` outside the `capp-workbench` endpoints.

## Two kinds of skills

- `.agents/skills/` holds **development** skills for agents working on this repo. They never ship.
- `packages/*/skills/` holds **product** skills the DSH Harness agent loads at runtime. Changing one is a behavior change: it needs the owning plugin's gate, not just a docs check.

## Changing and checking

- Follow software-engineering good practice at the scale the MVP needs. Reuse the existing contracts and helpers in `capp-common`; add an abstraction, config key or compatibility path only when it has a real consumer.
- Behavior changes update the owning doc and the needed tests in the same PR.
- Local checks (details in [docs/development.md](docs/development.md)):

  ```sh
  node scripts/check.mjs install-hooks   # once per clone
  node scripts/check.mjs docs            # always
  node scripts/check.mjs lint            # after pnpm install
  node scripts/check.mjs types test      # once the S0 workspace exists
  ```

- Pick verification by what changed. Docs-only: facts, links and the full diff. Code: lint, then typecheck and unit tests for pure modules. Anything touching NX, Mastercam, the host or a skill the Harness loads: the step's acceptance gate on the Windows machine ([docs/acceptance/README.md](docs/acceptance/README.md)). Report what actually ran, where, and what didn't. Never reuse an old result as a new pass.

## On-demand skills

Load only the one the task needs:

- [run-gates](.agents/skills/run-gates/SKILL.md): running checks, a gate, a PR regression or a Windows session, or investigating a failure.
- [maintain-docs](.agents/skills/maintain-docs/SKILL.md): adding, moving or fact-checking development docs.
- [maintain-prose](.agents/skills/maintain-prose/SKILL.md): sentence-level tightening of docs or comments.
- [maintain-decision-notes](.agents/skills/maintain-decision-notes/SKILL.md): a lasting rationale or a reversed decision that the spec and code don't explain ([notes](.agents/notes/README.md)).

## Delivering

One PR per spec step (spec §7), using the [PR template](.github/pull_request_template.md): the problem, the doc sync, what was verified and where, and the gate result or why the gate wasn't run. The user reviews; don't merge without being asked. A green CI run proves the mechanical checks only. It is never a gate, except G1.

After a PR merges, remove its worktree and delete the merged local branch. Keep the main checkout on `main`.
