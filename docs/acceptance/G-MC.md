# G-MC: Mastercam pipe bridge

Step: S-MC · Spec: §7 row S-MC

## Preconditions

- Mastercam 2026 running interactively on the Windows machine, user signed in, with the official NET-Scripting IPC add-in loaded (Add-Ins menu) — the `MastercamPipe<pid>` pipe does not exist until it is loaded.
- A copy of `torus-mcam` open in Mastercam (never the asset original).
- Assets by logical id: `torus-mcam`, `mill-turn-post`.
- Node ≥ 18 on the Windows machine for `probes/pipe-probe.mjs`.

## Script

1. `node bridge/mastercam/probes/pipe-probe.mjs bridge/mastercam/probes/count-ops.csx --set RESULT_PATH=<out>\count.json` → reply starts `Ran Successfully.`; `count.json` shows `"ops":7` and `"ids":[1,8,2,3,4,5,6]`.
2. `pipe-probe.mjs open-file.csx --set MCAM_PATH=<copy>.mcam --set RESULT_PATH=<out>\open.json` → `"opened":true`.
3. `pipe-probe.mjs post.csx --set POST_PATH=<mill-turn-post> --set NC_DIR=<empty dir> --set RESULT_PATH=<out>\post.json` → `"posted":true` and exactly one `.NC` file appears in the dir.
4. Written verdict in `bridge/mastercam/README.md`: which parameters .NET can edit and which need the C++ CHook.

## Pass criteria

The script result shows the expected operation count; a written note settles C# only vs a C++ CHook; the post-processing call path is recorded.

## Runs

### 2026-11-09 · pass
- Commit: `90773d8` (branch `spike/s-mc-pipe`; probes and this record are the gated artifacts; rebased onto `c5708da` afterwards, probe content unchanged)
- Mastercam 2026 (`28.0.7534`), Chinese UI; no DSH, no NX.
- Assets: `torus-mcam` (copy opened as a separate file), `mill-turn-post` = `MPLFAN.pst` — sha256 compared against the local asset manifest before the run (the example manifest carries placeholders for machine-local files). The posted `T.NC` (1914 bytes) is a probe output named after the program; it is not the Golden NC and its size is not compared against it.
- Seen:
  - `count-ops.csx` over `\\.\pipe\MastercamPipe<pid>`: greeting ended `options.`, reply `Ran Successfully.`; result `{"ops":7,"ids":[1,8,2,3,4,5,6]}` — matches the authoritative seven-operation order.
  - `open-file.csx`: `FileManager.Open(false, path, false, false)` returned true; `CurrentFileName` switched to the copy.
  - `post.csx`: `PostName` took the .pst, `NCPrompt` stayed false, `PostAllOperations(<dir>)` produced `T.NC` (1914 bytes) — NC is a review candidate only, never committed.
  - `list-ops.csx`: `GetOperationIDs(true)` → `[1,8,2,3,4,5,6]`; `GetOperations()` → empty array.
  - `dump-op.csx` / `probe-access.csx`: `GetOperation`, `OperationCaster`, `GetOperations` (all overloads incl. every `Lathe*` `OperationType`) all returned null/empty for the lathe ops — recorded so S5 does not re-run them.
  - Parameter verdict: `SearchManager.GetOperations()`/`GetOperation`/`OperationCaster` return null/empty for every operation on the lathe file; `Mastercam.Operations` has milling classes only (scan covered the `OperationsManager` assembly and `*Operation*` types); `Mastercam.Database.Operation` (which has `FeedRate`/`SpindleSpeed`/`Linking`/`MiscValues`/`Regenerate`/`Commit`) is unobtainable for lathe ops. **C++ CHook required for the eight parameters**; .NET covers pipe, count, open, post.
  - Operational findings recorded in `bridge/mastercam/README.md`: IPC add-in must be loaded in the UI first; a `.csx` compile error opens a modal that wedges the host until closed; script paths must not contain whitespace.
- Not run: the C++ CHook itself (S5 scope — the spike decides the path, it does not build it); `edit-regen` parameter write (no .NET path exists to test).
- Evidence kept locally (never committed): `out\count.json`, `out\open.json`, `out\post.json`, `out\access.json`, `out\nc1\T.NC` under the probe work dir; probe scripts under `probes\` in the same dir.
