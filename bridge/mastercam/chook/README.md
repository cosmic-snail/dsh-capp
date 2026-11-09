# Param-probe CHook (spike S-MC, task 6)

The smallest C++ CHook that answers the question .NET couldn't: **can one lathe operation parameter be written, regenerated and read back?** It's a spike probe, not the S5 bridge. S5 builds the real `apply-params`/`regen` path on what this proves.

| File | What it is |
|---|---|
| `param_probe.cpp` | The CHook: exports `m_version` and `m_main`; reads one request, edits one parameter of one operation, regenerates, writes `result.json` |
| `probe_request.hpp` | Request parsing and JSON output. Pure C++20, no SDK |
| `CappParamProbe.vcxproj` | Release/x64/v143/C++20/`/MD`/MFC DLL against the Mastercam 2026 SDK |
| `test/` | Portable tests; `sdk_stub.h` fakes just the SDK surface `param_probe.cpp` touches |
| `../probes/chook-param.csx` | C# caller: sets `CAPP_CHOOK_REQUEST`, calls `Mastercam.dll`'s `RunCHook`, writes a receipt |

SDK calls (learned from CAPPtron-core's native bridge, reference only): `operation_manager` with `OPMGR_GET`, `OPMGR_REWRITE`, `OPMGR_NCI_FLAG`, `OPMGR_NCI_REGEN`. Field mapping: `feed` = `tl.feed`, `rpm` = `tl.rpm`, `clearance` = `cmn.clearance_pln`, `retract` = `cmn.retract_pln`, `depth` = `cmn.depth`; on lathe rough (opcode 60) only, `rough_step` = `u.prm_lrgh.step`, `stock_x` = `u.prm_lrgh.stock_x`, `stock_z` = `u.prm_lrgh.stock_z`.

## Request and result

The request is a UTF-8 text file, one `key=value` per line:

```text
op_id=2
param=rough_step
value=0.4
result=<run-dir>\result.json
```

Omit `value` for a read-only run. `result` must not exist yet; each run gets a fresh directory.

`result.json` has `ok`, `error`, `op_id`, `param`, `requested`, `opcode`, `before` (all parameters the operation type has), `dirty_before`, then `after_rewrite`, `dirty_after_flag`, `dirty_after_regen` and `after_regen` as far as the run got, and `steps` (completed steps: `read`, `rewrite`, `readback`, `flag`, `regen`). `m_main` returns `MC_NOERROR` whenever `result.json` was written, including `ok:false`. `MC_ERROR` means the request was unreadable or the result couldn't be written.

## Build (Windows machine)

Needs VS 2022 Build Tools (v143, x64, MFC) and Windows SDK 10.0.22621.0 (spec §1.3), plus the Mastercam 2026 SDK. From a VS x64 developer prompt in this directory:

```bat
msbuild CappParamProbe.vcxproj /p:Configuration=Release /p:Platform=x64 /p:MastercamSdkRoot=<SDK root>
```

Output: `bin\CappParamProbe.dll` (`bin\`, `obj\`, `x64\` are gitignored). Check its exports with `dumpbin /exports bin\CappParamProbe.dll`: `m_main` and `m_version` must be listed.

The header set and libraries are a first-compile guess. If the build reports an undeclared `operation`, `operation_manager`, `DB_LIST_ENT_PTR` or an `OPMGR_*` constant, find the header that declares it under the SDK's `interfaces\` tree, add its include to `param_probe.cpp`, and record which one in the G-MC run record. For an unresolved external, add the import library that defines it.

## Run

Mastercam is open on a **copy** of `torus-mcam`, with the IPC add-in loaded. Use a work directory with no whitespace in its path. The script must compile on the first try (a compile error opens a modal that blocks Mastercam), so type-check it off Windows first (below).

```bat
rem read-only first: confirms load, dispatch and field mapping without changing anything
node probes\pipe-probe.mjs probes\chook-param.csx --set DLL=<abs>\CappParamProbe.dll --set REQUEST=<run1>\request.txt --set RECEIPT=<run1>\receipt.json
```

Then a write run in a new run dir, with `value=0.4` on the lathe rough operation, then `post.csx` into an empty dir and compare with a post taken at the original 0.5.

## Portable checks (any machine)

From this directory:

```sh
c++ -std=c++20 -Wall -Wextra -Werror -I . test/probe_request_test.cpp -o /tmp/probe-request-test && /tmp/probe-request-test
c++ -std=c++20 -Wall -Wextra -Werror -DCAPP_SDK_STUB -I . param_probe.cpp test/param_probe_test.cpp -o /tmp/param-probe-test && /tmp/param-probe-test
```

These prove the probe's own flow (request parsing, readback and dirty checks, never overwriting a result, the error paths) against a fake `operation_manager`. They don't prove the SDK's types, the build, the DLL loading or anything Mastercam does.

`chook-param.csx` uses only System APIs, so the C# compiler that ships with the .NET 8 SDK can type-check it once its placeholders are rendered. Render them into `Program.cs`, then:

```sh
dotnet <sdk>/Roslyn/bincore/csc.dll -nologo -nostdlib -noconfig -warnaserror \
  $(for f in <dotnet>/packs/Microsoft.NETCore.App.Ref/8.*/ref/net8.0/*.dll; do printf -- '-r:%s ' "$f"; done) Program.cs
```

That catches C# errors before they reach Mastercam's script host. It doesn't check the script host's own C# dialect or the `RunCHook` export.
