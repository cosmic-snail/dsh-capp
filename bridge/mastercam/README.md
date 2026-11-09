# bridge/mastercam — Mastercam 2026 bridge (S-MC verdict)

How dsh-capp drives Mastercam 2026 on the Windows machine. Verdict from spike S-MC (gate G-MC, 2026-11-09): **C# scripts over the official IPC pipe cover counting, file open and posting; lathe operation parameters require a C++ CHook.**

## Transport: official NET-Scripting IPC pipe

Mastercam 2026 ships an official IPC add-in (`CHOOKS\MCNETSCRIPTING\IPCSERVER.DLL`, "Mastercam NET-Scripting Add-In"). Once loaded, it listens on `\\.\pipe\MastercamPipe<pid>` where `<pid>` is the `Mastercam.exe` process id.

Protocol (verified):

1. Connect → server greets, text ends with `options.` (observed: `Connected in N ms. Enter a command. 'HELP' for options.`).
2. Write `RUN <absolute .csx path>` — the path must not contain whitespace.
3. Read until the reply ends with `Enter next command.`; success iff it starts with `Ran Successfully.`
4. Scripts report results by writing files; the pipe carries no payload back.

`probes/pipe-probe.mjs` implements this with no dependencies: it finds the single `Mastercam.exe` pid via `tasklist`, renders `{{NAME}}` placeholders into a temp `.csx`, and prints the greeting/reply verbatim. Each read has a 30 s timeout.

**Operational findings:**

- The IPC add-in must be **loaded in the Mastercam UI** (Add-Ins) before the pipe exists; a running `Mastercam.exe` alone does not create it.
- A `.csx` **compile error opens a modal dialog** that wedges the script host and the pipe until a human closes it. Every probe must compile cleanly on the first run; `{{...}}` placeholders must all be rendered.
- `FileManager.Open` signature is `Open(bool promptToSave, string path, bool mergeWithCurrent, bool openAsText)` — verified: opens a `.mcam` copy programmatically.

## What .NET can do (verified on the Golden-B7 lathe part)

| Capability | API | Evidence |
|---|---|---|
| Count operations | `Mastercam.Support.SearchManager.GetOperationIDs(true)` → `int[]` | `probes/count-ops.csx`: 7 ops, ids `[1,8,2,3,4,5,6]` matching the authoritative order |
| List op types | `SearchManager.GetOperations(...)` | returns **empty for every `OperationType` on a lathe file** — see below |
| Open document | `Mastercam.IO.FileManager.Open(false, path, false, false)` | `probes/open-file.csx`: `opened:true`, `CurrentFileName` switched |
| Post to NC | `OperationsManager.PostName = <abs .pst>`; check `NCPrompt == false`; `PostAllOperations(<empty dir>, false, false, false)` | `probes/post.csx`: produced `<dir>\T.NC` (1914 bytes) with `MPLFAN.pst`; the argument is an **output directory**, the file is named after the program |

## What .NET cannot do: lathe operation parameters

The eight parameters the workflow edits — `feed`, `rpm`, `clearance`, `retract`, `depth`, `rough_step`, `stock_x`, `stock_z` — are unreachable from C# on this part:

- `Mastercam.Operations.*` contains **only milling operation classes** (Pocket, CircleMill, Contour, Drill, …). No lathe/turning classes exist in any namespace (`OperationType` lists `LatheRouging`, `LatheFinishing`, … as enum values only).
- `Mastercam.Database.Operation` is the type-agnostic entity (`FeedRate`, `SpindleSpeed`, `RetractRate`, `Linking` → `LinkingParams` with `Clearance`/`Retract`/`Depth`/`FeedPlane`/`TopStock`, `MiscValues` → 10 reals + 10 ints, `Commit()`, `Regenerate()`, `Post()`). **But no accessor returns one for a lathe op**: `SearchManager.GetOperation(id)`, `SearchManager.GetOperations()` (all overloads incl. group id and every `Lathe*` type), and `Typecaster.OperationCaster(id)` all returned null/empty on the Golden-B7 file (`probes/probe-access.csx`).
- `Mastercam.Support.OpManagerSettings` exposes only Dirty/Ghosted/Locked/Selected/Visible flags — no parameters.

Conclusion: parameter read/write and regeneration for lathe ops go through the **C++ CHook** (`operation_manager` `OPMGR_GET`/`OPMGR_SET`, `OPMGR_NCI_REGEN`), invoked from a `.csx` via the `Mastercam.dll` export `RunCHook` (`?RunCHook@@YA_NPEB_W_NPEAH@Z`). This is the same split CAPPtron uses: .NET for orchestration, CHook for lathe parameters. The CHook itself is built in S5, not in this spike.

## Non-working approaches (recorded so S5 doesn't retry them)

- `SearchManager.GetOperations()` / `GetOperation(id)` / `Typecaster.OperationCaster(id)` on lathe ops → null/empty (verified exhaustively).
- Reflection over `Mastercam.Operations` for lathe parameter classes → none exist.
- `MiscValues` indexed bag → unreachable because no `Database.Operation` object is obtainable.

## Files

- `probes/pipe-probe.mjs` — dependency-free pipe client (Node ≥ 18).
- `probes/count-ops.csx`, `list-ops.csx`, `dump-op.csx`, `probe-access.csx` — read-only probes.
- `probes/open-file.csx`, `post.csx` — verified working probes.
- .csx files contain `{{NAME}}` placeholders rendered by `pipe-probe.mjs --set NAME=VALUE`.

All probe outputs stay on the Windows machine under the probe work dir; NC files and `.mcam` copies are never committed ([docs/assets.md](../../docs/assets.md)).
