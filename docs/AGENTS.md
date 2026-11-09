# Maintaining docs

These rules extend the [root agent rules](../AGENTS.md). Each fact has one owner; other pages link to it instead of repeating it.

| Page | Owns |
|---|---|
| [README.md](README.md) | Navigation only |
| [status.md](status.md) | What is merged on `main`, which gates have passed, and where the evidence is |
| [design.md](design.md) | Product intent, principles, file formats, tool contracts, the open-source boundary |
| [spec.md](spec.md) | Locked stack, architecture, module boundaries, interfaces, guardrails, steps and gates. Wins over design.md for engineering |
| [assets.md](assets.md) | Where private assets live and how a developer wires them up |
| [development.md](development.md) | Local checks, the git hook, CI and what each proves |
| [plans/](plans/mvp-execution.md) | How spec §7 steps are executed: work packages, tasks, gate outlines. Never overrides the spec or design |
| `host-patches.md` | Unavoidable changes to the host; they go into a fork of dataelement/dsh-desktop (create the page with the first patch) |
| [acceptance/](acceptance/README.md) | One gate script per gate, with dated run records |
| `experiments/` | Dated experiment reports, such as the mode A/B planning runs |
| [.agents/notes/](../.agents/notes/README.md) | Lasting decision rationale that the spec and code don't explain |

- **status.md describes `main` only.** Unmerged work goes in the PR description. Don't add "pending merge" rows. When a capability or gate changes, rewrite the row instead of appending a dated paragraph.
- **Current pages carry no dated narrative.** Dated results belong in `acceptance/` or `experiments/`. A record keeps its date and baseline forever; "current" inside an old record means current for that baseline only. Correct a past fact by adding a dated correction with its source, never by rewriting the result.
- **Every page in `docs/` outside the archive folders must be reachable** from the root README, root AGENTS or docs/README. Add the navigation link in the same change.
- **No machine-specific facts**: no personal home paths, user profiles, worktree paths, private IP addresses or machine names. Refer to the Windows machine as "the Windows machine". Record history by commit SHA or branch.
- **Link to derivable lists instead of copying them**: env vars, test counts, directory listings and dependency versions live in source or config. The spec's locked versions are the exception, because they are a decision.
- Before changing a fact, check it against the code, the test or the original record. A plan step, a tool reporting success or a green CI run isn't acceptance. If something couldn't be run, say which environment was missing.
- When moving a file, fix relative links and inbound links in the same change.
- Write sentences with a subject, an action, a condition and a consequence. Keep cancellation, persistence, failure and ownership statements; cut restated code, aimless step numbers and stale future tense. Don't cut information to hit a length.
- A docs-only PR checks the full diff, the link targets and any command it documents. A command is "verified" only after it has run in the environment it names. Don't grow a docs tidy-up into a refactor or a new check framework.

`node scripts/check.mjs docs` enforces the mechanical parts of these rules; [development.md](development.md#docs-check) lists exactly which. Passing it doesn't make the facts right.
