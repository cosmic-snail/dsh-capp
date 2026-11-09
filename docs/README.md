# Docs

Start with [status](status.md) to see what is merged and which gates have passed. Agent rules are in the [root AGENTS](../AGENTS.md); how docs are maintained is in [docs/AGENTS](AGENTS.md).

| Question | Read |
|---|---|
| What are we building, and what's out of scope? | [Design](design.md) §1–2 |
| File formats, tool contracts, the workflow | [Design](design.md) §5–7 |
| Locked versions, architecture, module boundaries, interfaces | [Spec](spec.md) §1–4 |
| Coding standards, the complete guardrail list, anti-patterns | [Spec](spec.md) §6 |
| Which step is next and what its gate is | [Spec](spec.md) §7, then [status](status.md) |
| What's in git and what isn't; wiring up private assets | [Assets](assets.md), [Design](design.md) §8 |
| Local checks, the git hook, CI | [Development](development.md) |
| Running and recording an acceptance gate | [Acceptance](acceptance/README.md) |
| Why a decision was made | [Decision notes](../.agents/notes/README.md) |
| Development skills for agents | [Root AGENTS](../AGENTS.md#on-demand-skills) |

## Using historical material

Gate records in `acceptance/` and reports in `experiments/` are bound to the commit and DSH version they name. An old pass doesn't carry over to a new commit. Re-run the gate when the code it covers changes.
