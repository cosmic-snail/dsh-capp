# G-MC: Mastercam pipe bridge

Step: S-MC · Spec: §7 row S-MC

## Preconditions

- Mastercam 2026 running interactively on the Windows machine, user signed in, with the official NET-Scripting IPC add-in loaded (Add-Ins menu) — the `MastercamPipe<pid>` pipe does not exist until it is loaded.
- A copy of `torus-mcam` open in Mastercam (never the asset original).
- Assets by logical id: `torus-mcam`, `mill-turn-post`.
- Node ≥ 18 on the Windows machine for `probes/pipe-probe.mjs`.
- For steps 5–8: VS 2022 Build Tools (v143, x64 MFC), Windows SDK 10.0.22621.0 and the Mastercam 2026 SDK; `bridge/mastercam/chook/` built per its README.

## Script

1. `node bridge/mastercam/probes/pipe-probe.mjs bridge/mastercam/probes/count-ops.csx --set RESULT_PATH=<out>\count.json` → reply starts `Ran Successfully.`; `count.json` shows `"ops":7` and `"ids":[1,8,2,3,4,5,6]`.
2. `pipe-probe.mjs open-file.csx --set MCAM_PATH=<copy>.mcam --set RESULT_PATH=<out>\open.json` → `"opened":true`.
3. `pipe-probe.mjs post.csx --set POST_PATH=<mill-turn-post> --set NC_DIR=<empty dir> --set RESULT_PATH=<out>\post.json` → `"posted":true` and exactly one `.NC` file appears in the dir.
4. Written verdict in `bridge/mastercam/README.md`: which parameters .NET can edit and which need the C++ CHook.
5. Build `bridge/mastercam/chook/CappParamProbe.vcxproj` → `bin\CappParamProbe.dll`; `dumpbin /exports` lists `m_main` and `m_version`. Record any header or library the first build needed added.
6. For each of the 7 operation ids, a read-only `chook-param.csx` run (request without `value`, fresh run dir each) → `receipt.json` has `"loaded":true,"return_code":0`; `result.json` has `"ok":true`, the operation's `opcode` and `before` values. This finds the lathe rough operation (opcode 60) and shows whether the field mapping reads plausible values.
7. Post into an empty dir with `post.csx` (baseline at the template value). Then one write run on the lathe rough operation, `param=rough_step`, `value=0.4` → `result.json` `"ok":true`, `steps` ends with `"regen"`, `dirty_after_regen` is false, `after_regen.rough_step` is 0.4.
8. Post again into another empty dir → one `.NC` file; compare it with step 7's baseline locally. The NC differs in the roughing passes. Neither NC is committed.

Steps 5–8 were added after the first run below, which predates them.
## Pass criteria

The script result shows the expected operation count; a written note settles C# only vs a C++ CHook; the post-processing call path is recorded. That's spec §7's G-MC.

With steps 5–8 (execution plan, S-MC task 6), additionally: one lathe parameter is written through the CHook, regenerated and read back changed, and a post after the change succeeds. Until a run passes steps 5–8, the CHook route in spec A6 is a decision, not a demonstrated result.

## Runs

### 2026-11-09 · pass
- Commit: `90773d8` (branch `spike/s-mc-pipe`; probes and this record are the gated artifacts; rebased onto `c5708da` afterwards, probe content unchanged)
- Mastercam 2026 (`28.0.7534`), Chinese UI; no DSH, no NX.
- Assets: `torus-mcam` (copy opened as a separate file), `mill-turn-post` = `MPLFAN.pst` — sha256 verified against the local asset manifest before the run; the same value is recorded in `assets/manifest.example.json`. The posted `T.NC` (1914 bytes) is a probe output named after the program; it is not the Golden NC and its size is not compared against it.
- Seen:
  - `count-ops.csx` over `\\.\pipe\MastercamPipe<pid>`: greeting ended `options.`, reply `Ran Successfully.`; result `{"ops":7,"ids":[1,8,2,3,4,5,6]}` — matches the authoritative seven-operation order.
  - `open-file.csx`: `FileManager.Open(false, path, false, false)` returned true; `CurrentFileName` switched to the copy.
  - `post.csx`: `PostName` took the .pst, `NCPrompt` stayed false, `PostAllOperations(<dir>)` produced `T.NC` (1914 bytes) — NC is a review candidate only, never committed.
  - `list-ops.csx`: `GetOperationIDs(true)` → `[1,8,2,3,4,5,6]`; `GetOperations()` → empty array.
  - `dump-op.csx` / `probe-access.csx`: `GetOperation`, `OperationCaster`, `GetOperations` (all overloads incl. every `Lathe*` `OperationType`) all returned null/empty for the lathe ops — recorded so S5 does not re-run them.
  - Parameter verdict: `SearchManager.GetOperations()`/`GetOperation`/`OperationCaster` return null/empty for every operation on the lathe file; `Mastercam.Operations` has milling classes only (scan covered the `OperationsManager` assembly and `*Operation*` types); `Mastercam.Database.Operation` (which has `FeedRate`/`SpindleSpeed`/`Linking`/`MiscValues`/`Regenerate`/`Commit`) is unobtainable for lathe ops. **C++ CHook required for the eight parameters**; .NET covers pipe, count, open, post.
  - Operational findings recorded in `bridge/mastercam/README.md`: IPC add-in must be loaded in the UI first; a `.csx` compile error opens a modal that wedges the host until closed; script paths must not contain whitespace.
- Not run: the C++ CHook — G-MC steps 5–8 are added by #9 and run there; `edit-regen` parameter write has no .NET path (recorded above).
- Evidence kept locally (never committed): `out\count.json`, `out\open.json`, `out\post.json`, `out\access.json`, `out\nc1\T.NC` under the probe work dir; probe scripts under `probes\` in the same dir.

### 2026-11-09 · pass (CHook steps 5–8)
- Commit: `cb31dbd` plus the build fixes recorded below (branch `spike/s-mc-chook`)
- Same Mastercam session and `torus-b.mcam` copy as the run above; `mill-turn-post` unchanged.
- Build: `CappParamProbe.vcxproj` Release|x64 with MSBuild v143 + WinSDK 10.0.22621.0 → `bin\CappParamProbe.dll`; `dumpbin /exports` lists `m_main` and `m_version`. First build needed `#include "AssocHok_CH.h"` (`interfaces\Mill\`, declares `operation_manager`/`OPMGR_*`) and the `NGP\Core\gaf\base\misc\h` include dir (`UtArray.h`). `MastercamSdkRoot` pointed at a complete SDK extraction; a stub-header SDK tree fails on empty `UtArray.h`.
- Step 6, read-only `chook-param.csx` on all 7 ids: every `receipt.json` `loaded:true, return_code:0, on_ui_thread:true`; every `result.json` `ok:true, steps:["read"]`. `before` values match the authoritative readback exactly — op 2 and op 4 (opcode 60) show `rough_step:0.5, stock_x:0.2, stock_z:0.1`; op 8 shows `clearance:5, depth:-5`.
- Step 7: baseline post → `nc-base\T.NC` (1918 bytes). Write run `op_id=2, param=rough_step, value=0.4` → `ok:true`, `steps:["read","rewrite","readback","flag","regen"]`, `dirty_after_flag:true`, `dirty_after_regen:false`, `after_regen.rough_step:0.4`.
- Step 8: post → `nc-after\T.NC` (1919 bytes); `fc /b` reports the files differ — the parameter change reached the posted NC. Neither NC committed.
- The write ran on the disposable `torus-b.mcam` copy (now holds `rough_step:0.4`); the asset original was never opened for writing.
- Evidence kept locally (never committed): `chook-out\op*-readonly\{receipt,result}.json`, `chook-out\op2-write\{receipt,result}.json`, `out\nc-base\T.NC`, `out\nc-after\T.NC`, request files under `chook-req\`, build log under the chook work dir.
