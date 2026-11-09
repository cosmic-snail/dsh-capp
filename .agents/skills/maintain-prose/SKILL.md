---
name: maintain-prose
description: Use when dsh-capp development docs or code comments need tightening, completing, removing chat leftovers, or a sentence-level review. Product skills under packages/*/skills, system-prompt sections and tool descriptions are behavior, not prose.
---

# Maintain prose

Work only in the authorized scope, and first decide whether you are reviewing (suggest) or rewriting (edit). Text the Harness agent sees at runtime is behavior: `packages/*/skills/**/SKILL.md`, `ctx.systemPrompt.section` text, tool descriptions and parameter docs, and `CappError` messages. Treat a change to any of them as a behavior change verified by the owning gate, never as a prose cleanup.

Before editing, extract the claims: who does what, under which condition and in what order, who owns the resource, side effects, how failure is handled, and what is explicitly not guaranteed. Check each against the rewrite, then cut repetition, empty adjectives and narration that only made sense in the chat. Keep existing limits and negative guarantees next to the claim they limit, not behind a distant link.

Example: "CAM refuses unless approval.json matches the current plan hash; a failed run is re-run as a new run directory, and NC is a candidate for human review" must not shrink to "CAM checks approval and retries on failure". That loses the hash binding, invents an automatic retry (spec §6.2 forbids one) and drops the review limit.

| Finding | Action |
|---|---|
| Correct and clear | Leave it. Don't rewrite to make a diff |
| Same fact in two places | Keep the owner's text; link from the other and keep any local precondition |
| Missing failure handling or ownership | Fill it in from the code or evidence, never from imagination |
| Old state in a dated record | Keep its date and baseline; add a dated correction if needed |
| Unsure of the meaning | Mark it to be checked; don't delete the limit and call the result equivalent |

Read the full diff afterwards. New behavior claims are verified per [development](../../../docs/development.md). Move to [maintain-docs](../maintain-docs/SKILL.md) only when files move or a fact changes owner; don't grow this into repo-wide governance.

[Sources](../../SOURCES.md).
