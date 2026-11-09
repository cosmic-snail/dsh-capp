---
name: maintain-decision-notes
description: Use when dsh-capp has a choice that needs a lasting explanation, real alternatives worth recording, or a reversal of an earlier decision, or when reviewing existing decision notes. Not for task progress or local wording.
---

# Maintain decision notes

Read the [notes entry](../../notes/README.md), then search existing notes, [spec](../../../docs/spec.md) §2 (A1–A7), §6.3–6.4 and §8, the topic guides and the original evidence. Write down which reason the existing material is missing. If you can't name one, link the existing material, say no note is added, and stop. Don't paraphrase an existing reason onto another page to have a note.

When a note is needed, follow the [template](../../templates/decision-note.md): problem, real alternatives, decision, cost, limits and evidence. Mark undocumented history as unknown; today's guess is not what was considered back then. Discuss a new choice as a proposal first.

- Proposals go in `proposed/`. Move to `implemented/` once the change and its evidence exist; rejected choices go in `rejected/`. Create a folder only for its first note.
- When the status changes, rewrite the body too: the proposal becomes the decision taken, acceptance conditions become evidence and gaps, and inbound links are fixed. A PR or plan alone isn't implementation. If the evidence comes only from an unmerged branch, record that commit and PR and say it isn't merged; `implemented/` then means implemented at that baseline, and status.md isn't updated from it.
- Fix a factual error in place. A reversal gets a new note, linked both ways with the old one, saying when and why it replaces the old one and which limits still hold. A partial replacement keeps each note's unique reasons.
- Don't write session logs or task lists. Progress goes in the PR; gate results go in `docs/acceptance/`. No archive freezing, hash guards or global config.

Ask whether the note would make the next person choose differently, not just restate the code. Report the reason and evidence added, or an explicit "existing material is enough, no note". Load [maintain-prose](../maintain-prose/SKILL.md) only if sentences need work.

[Sources](../../SOURCES.md).
