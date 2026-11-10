# Status

Describes `main` only. Unmerged work lives in its PR. Update a row when its step merges or its gate result changes; dated evidence goes in [acceptance/](acceptance/README.md). Steps and gates are defined in [spec §7](spec.md#7-implementation-plan-and-acceptance-gates).

Baseline: design, spec, asset boundary, the development pipeline, S0 and S1 (`capp-common` contracts). S-MC and S-NX spikes are done: the Mastercam pipe/CHook path and the NX batch path are both verified on the Windows machine (G-MC, G-NX).

| Step | State on `main` | Gate | Evidence |
|---|---|---|---|
| S0 Skeleton | Done | G0 passed | [G0](acceptance/G0.md) 2026-11-09, commit `4d7d37d` |
| S-MC Mastercam pipe spike | Done | G-MC passed | [G-MC](acceptance/G-MC.md) 2026-11-09/10, commit `c9b7fb9` |
| S-NX NX batch spike | Done | G-NX passed | [G-NX](acceptance/G-NX.md) 2026-11-09, commit `a91f775` |
| S1 Common | Done | G1 passed | [G1](acceptance/G1.md) 2026-11-10 |
| S2 Step | Not started | G2 not run | none |
| S3 Planning (mode A) | Not started | G3 not run | none |
| S4 Workbench | Not started | G4 not run | none |
| S5 CAM | Not started | G5 not run | none |
| S5b Simulate (optional) | Not started | G5b not run | none |
| S6 End to end | Not started | G6 not run | none |
| S7 Mode B + experiment | Not started | G7 not run | none |

States: *Not started*, *In progress* (merged code, gate not passed), *Done* (gate passed on the Windows machine at the commit in the evidence link). A step whose code changed after its gate passed goes back to *In progress* until the gate is re-run.

## What is not claimed

CI runs mechanical checks on GitHub-hosted runners. It doesn't run DSH, NX or Mastercam. No NC output from this project is a manufacturing result; NC is a candidate for human review only.
