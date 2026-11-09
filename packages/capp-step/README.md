# capp-step

STEP → part analysis for the CAPP workflow. This package is created by spike S-NX; the plugin code lands in S2.

## NX batch invocation (S-NX verdict)

NX 2306 runs journals through `run_journal.exe`, not a standalone Python. Verified on the Windows machine:

```bat
cd /d <work-dir>
"%UGII_BASE_DIR%\NXBIN\run_journal.exe" <work-dir>\journal.py
```

- `journal.py` is rendered from [`nx/journal.py.tpl`](nx/journal.py.tpl): the `{{NAME}}` placeholders become absolute paths (work dir, STEP file, STEP214 settings file, extractor script, output dir). All paths inside the journal are absolute, so the working directory only needs to be writable.
- Environment: `UGII_BASE_DIR`, `UGII_LANG`, `SPLM_LICENSE_SERVER` are required and are already set as system environment variables on the Windows machine — a plain shell inherits them, nothing had to be recovered from the registry. `UGS_LICENSE_BUNDLE` is absent there and the run succeeded without it.
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
