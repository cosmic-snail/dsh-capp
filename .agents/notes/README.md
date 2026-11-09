# Decision notes

Notes keep the lasting reasons behind a choice that the [spec](../../docs/spec.md), the [design](../../docs/design.md) and the code don't already explain. Before writing one, search for an existing note and follow the [decision-notes skill](../skills/maintain-decision-notes/SKILL.md). Progress goes in the PR, gate results go in [acceptance](../../docs/acceptance/README.md), and neither chat logs nor a second task list belong here.

Notes live in `proposed/`, `implemented/` or `rejected/` and are named `YYYY-MM-DD-topic.md`. Create a folder only when its first note arrives. Use the [template](../templates/decision-note.md) and keep the folder, the `Status:` line and the body consistent; the [docs check](../../docs/development.md#docs-check) enforces the structure, not the value.

An architectural decision that is already in spec §2 (A1–A7) stays there. A note is for a reason the table row can't hold, for example the alternatives that were measured, or for a reversal of an earlier choice.

There's no central index. Link a note from the doc whose rule it explains.
