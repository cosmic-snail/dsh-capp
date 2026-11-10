# capp-step

STEP → part analysis for the CAPP workflow. This package is created by spike S-NX; the plugin code lands in S2.

## NX batch invocation (S-NX verdict)

NX 2306 runs journals through `run_journal.exe`, not a standalone Python. Verified on the Windows machine:

```bat
cd /d <work-dir>
"%UGII_BASE_DIR%\NXBIN\run_journal.exe" <work-dir>\journal.py
```

- `journal.py` is rendered from [`nx/journal.py.tpl`](nx/journal.py.tpl): the `{{NAME}}` placeholders become absolute paths (work dir, STEP file, STEP214 settings file, extractor script, output dir). All paths inside the journal are absolute, so the working directory only needs to be writable.
- NX 2306 embeds **Python 3.10** (`NXBIN\python310.dll`); `run_journal.exe` runs the journal on it. The analyzer is a separate step on a normal Python 3 (3.12 verified).
- The journal couples to the extractor's internals: it sets the module global `extractor.OUTPUT_DIRECTORY` and calls `extractor.main_v7()`. That contract is pinned only by the extractor's sha256 — a new extractor version may need a journal change.
- Environment: `UGII_BASE_DIR`, `UGII_LANG`, `SPLM_LICENSE_SERVER` are required and are already set as system environment variables on the Windows machine — a plain shell inherits them, nothing had to be recovered from the registry. `UGS_LICENSE_BUNDLE` is absent there and the run succeeded without it. Whether the Harness `ctx.sandbox.confine`/`ctx.subprocess.spawn({ env })` path inherits these system variables is still open; it is tracked with S-PERM in S2.
- The STEP214 importer uses the `step214ug.def` settings file (`nx-step-settings` asset, inside the NX install's `STEP214UG` directory).
- The extractor (`nx-extractor` asset) is loaded inside the journal via `importlib` and writes its report under `<work-dir>\extraction\`; the journal copies the single JSON to `<out-dir>\nx-report.json`.
- Observed run time on the torus STEP: about 2 minutes for the NX part, about 20 seconds for the analyzer.

## Analyzer (plain Python, separate step)

```bat
<python> <analyzer-script> <nx-report.json> <analysis.json>
```

- `<python>` is any Python 3; on the Windows machine the working interpreter is the per-user Python 3.12 install — the `python` on PATH resolves to a nonfunctional WindowsApps alias there, so call the interpreter by absolute path.
- `<analyzer-script>` is the `nx-analyzer` asset (`deterministic_geometry_manufacturing_analyzer.py`); its `__main__` entry is `main_v3(input, output)`.
- Outputs: `analysis.json` plus `analysis.log` beside it.

## Report shapes (top-level keys only)

- `nx-report.json` (`capp.nx-report` content): `environment`, `extracted_at`, `extractor`, `issues`, `limitations`, `process_planning_agent_input`, `raw_prt_extraction`, `schema_version`.
- `analysis.json`: `analysis_contract`, `analyzed_at`, `canonical_geometry`, `coordinate_registry`, `data_quality`, `diagnostics`, `manufacturing_model`, `requirements_and_context_status`, `schema_version`, `source_part`, `source_revision_state`, `source_schema_version`, `topology_graph`.

Both JSON files stay in the session workspace on the Windows machine; they are never committed ([assets](../../docs/assets.md)).

## Plugin (S2)

`step_parse({ step_path, job_id? })` parses a STEP file into `capp/<job>/part.json` (`capp.part/v0`). `step_path` is relative to the session workspace; the STEP is copied to `input/`, the NX journal + analyzer write `nx/nx-report.json`, `nx/analysis.json` and `nx/nx.log`, and `normalize.ts` maps the reports to the open feature vocabulary — unmapped items become `warnings`, never blocks.

### Config (cordis.patch / plugin config)

| Key | Meaning |
|---|---|
| `nxRoot` | NX install root; fallback for `UGII_BASE_DIR` |
| `extractorScripts.extractor` | absolute path to the nx-extractor script (sha256-pinned contract with `journal.py.tpl`) |
| `extractorScripts.analyzer` | absolute path to `deterministic_geometry_manufacturing_analyzer.py` |
| `stepSettings` | absolute path to `step214ug.def` (`nx-step-settings` asset) |
| `journalRunner` | absolute path to `run_journal.exe` |
| `pythonPath` | absolute path to a Python 3 interpreter for the analyzer (not the PATH `python` — it is a broken WindowsApps alias on the test machine) |
| `timeoutMs` | journal+analyzer budget, default 600000; the tool timeout is this +30s |

Machine paths live only in local plugin config, never in the repo ([assets](../../docs/assets.md)).

### Environment

`env.ts` starts from `process.env`; a missing `UGII_BASE_DIR`/`UGII_LANG`/`SPLM_LICENSE_SERVER`/`UGS_LICENSE_BUNDLE` is read from the registry (`reg query …\Environment /v NAME`) via `ctx.subprocess`, `UGII_BASE_DIR` falls back to `nxRoot`, and anything still missing throws a `CappError` naming it. Whether the Harness sandbox lets these subprocesses run and write into the job dir is the S-PERM question — see spec §8 and `docs/acceptance/G2.md`.
