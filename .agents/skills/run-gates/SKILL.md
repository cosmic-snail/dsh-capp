---
name: run-gates
description: Use when running dsh-capp checks, an acceptance gate (G0–G7, G-MC, G-NX), a PR regression, a Windows session with DSH/NX/Mastercam, or investigating a failure or watching a manual run. Discussing a test plan alone doesn't authorize running anything.
---

# Run checks and gates

Say briefly that you are following this workflow. Commands come from [development](../../../docs/development.md); gate scripts and record format from [acceptance](../../../docs/acceptance/README.md); gate definitions from [spec §7](../../../docs/spec.md#7-implementation-plan-and-acceptance-gates). Don't copy machine setup or gate text into your report.

## Scope

From the request and context, settle in one paragraph: commit, entry point, inputs, expected behavior and the finish line. Reuse access the user already gave (a connected folder, a running DSH, a signed-in Mastercam) without asking again. If the environment is broken, report exactly what's missing; don't reinstall or restart things you didn't start.

| Request | Scope and finish line |
|---|---|
| Check a PR / regression | Pick checks by the diff: `docs` always; `types test` for code; the step's gate only if the diff touches what the gate covers. Don't start Mastercam by default |
| Run gate G<n> | Follow `docs/acceptance/G<n>.md` to its pass criteria on the Windows machine, with the packages built from the named commit. A unit test or a CLI call doesn't substitute for a Harness session |
| Investigate and fix | First error verbatim, smallest repro, a fix inside the authorized scope, then re-check step by step. Don't grow it into a refactor |
| Watch a manual run | Read-only: status files, logs, `status.json`. Don't take over the UI or start runs |
| Discuss a plan | Give the plan; run nothing |

## Running

1. State the expected behavior first. For paths, hashes and file contents, separate "where it's installed", "what it means for machining", "byte identity" and "run continuity". Don't add a validation to paper over an unclear requirement (spec §6.3 is the complete guardrail list).
2. For platform questions, prefer the smallest real probe you're authorized for: a trivial C# script over the Mastercam pipe, one NX batch call, one tool call in a Harness session. Say which process or API you touch and when you stop. Pure unit tests need no Windows machine.
3. Go from the local action to the neighboring step to the final target. Each attempt uses a fresh job or run directory (principle 2); keep the old failure and don't patch diagnostics into an old run.
4. When iterating, re-run only the affected checks; for a candidate, run the full set, install the packed `.tgz` into DSH, and check the latest commit's CI. Repeat a passed check only after a new change, a failure or an open question.

## Investigating

Keep the first error, the job id, run id and the last completed step. Separate a business failure (`status.json` failed with a message) from an unknown outcome (the pipe dropped mid-step) and from a delivery problem (the package didn't install). There's no recovery logic by design: an unknown outcome is reported as unknown and re-run as a new run, never written up as success.

Log it as: blocker → known facts → candidate causes → smallest experiment and its expected result → actual result → next step. Mark what was observed on the machine, reproduced independently, inferred, or not reproduced. A rerun that passes doesn't prove an intermittent fault is fixed.

## Evidence and delivery

Prove the change reached the consumer: the `.tgz` hash installed in DSH, the plugin version the Harness reports, the asset ids and hashes from the local manifest. Results from an older package are background only, and labeled as such.

Append the run to `docs/acceptance/G<n>.md` per its format, with no screenshots, NC text, logs or machine names in git; name local evidence files instead. Update [status](../../../docs/status.md) only after the PR merges. Report scope and commit, commands and platform, results, how certain the cause is, what's unfinished, and where the evidence is. Software checks, a Harness session, NX, Mastercam and NC review are reported separately.

Handle side issues by whether they block the target: necessary fixes as reviewable commits, the rest as a follow-up with evidence and an acceptance condition. Keep going under the existing authorization without adding a confirmation step for every action.
