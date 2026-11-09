---
name: maintain-docs
description: Use when dsh-capp development docs, navigation, status or the development guide need adding, restructuring, moving or fact-checking. For sentence-level polish only, use maintain-prose.
---

# Maintain development docs

Read the AGENTS file for the area, the current page, and the code or evidence it describes. Use the [docs rules](../../../docs/AGENTS.md) to find each fact's owner. Don't conclude something is unimplemented because an old checkout lacks a file or a plan is still in future tense.

1. List the facts this change touches and what the reader must be able to do. Current state goes in [status](../../../docs/status.md); product intent and file formats in [design](../../../docs/design.md); engineering decisions, interfaces, guardrails and gates in [spec](../../../docs/spec.md); commands and failure handling in the topic guide; dated results in `docs/acceptance/` or `docs/experiments/`. Navigation only links.
2. Check commands, defaults, platforms and limits against the target commit's code, tests or original records. Old counts belong to their old record. A check you didn't run on the new commit is written as not run.
3. Before moving a file or renaming a heading, search for links into and out of it. Fix relative paths, anchors and navigation in the same change. Old records keep their date, steps and results.
4. Verify per [development](../../../docs/development.md). Docs-only: facts, affected links and the full diff. A new command is run as written; if the environment it names (often the Windows machine) isn't available, say so. Run `node scripts/check.mjs docs`; passing it doesn't verify facts or anchors.

Load [maintain-prose](../maintain-prose/SKILL.md) only for sentence-level problems, and [maintain-decision-notes](../maintain-decision-notes/SKILL.md) only when a lasting reason doesn't fit any existing doc.

In the PR, say which fact moved owner, what was verified and what wasn't. A shorter page isn't evidence of better maintainability; observable results, failure consequences and resource ownership must survive de-duplication.

[Sources](../../SOURCES.md).
