# Acceptance gates

Each gate in [spec §7](../spec.md#7-implementation-plan-and-acceptance-gates) gets one file, `G<n>.md` (for example `G0.md`, `G-MC.md`). Passing its script on the Windows machine **is** the gate (spec §6.5). Write the script before the step's PR asks for review, and append a run record every time the gate is run, whether it passed or failed.

These are archive pages: run records are dated and never rewritten. The current pass/fail state per step is in [status](../status.md).

## File shape

```markdown
# G<n>: <gate name>

Step: S<n> · Spec: §7 row S<n>

## Preconditions
What must be installed, synced or configured. Name assets by logical id, never by path on a machine.

## Script
1. Action → expected result.
2. …

## Pass criteria
The observable results that make this a pass. Anything outside them doesn't count.

## Runs

### <YYYY-MM-DD> · <pass | fail | partial>
- Commit: <sha> (branch / PR)
- DSH: <fork version or commit> · NX / Mastercam versions if used
- Plugin packages: <file names and sha256 of the installed .tgz>
- Seen: what actually happened at each step, including the first error verbatim
- Not run: steps skipped and why
- Evidence kept locally (never committed): recording, logs, session export, by file name only
```

## Rules

- A run counts only for the commit and package hashes it names. If the code under the gate changes, run the gate again.
- Keep the first failure as the record even when a rerun passes; add the rerun as its own entry.
- Software checks, a real Harness session, NX, Mastercam and NC review are reported separately. A non-empty `program.nc` isn't a manufacturing result.
- No screenshots, NC text, MCAM files, logs or machine names in this folder ([assets](../assets.md)). Describe what you saw and name the local evidence file.
