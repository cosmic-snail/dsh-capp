# G-NX: NX batch reports

Step: S-NX · Spec: §7 row S-NX

## Preconditions

- Siemens NX 2306 installed on the Windows machine (`UGII_BASE_DIR` set).
- Assets by logical id, synced outside the repo: `torus-step` (the STEP input), `nx-step-settings` (the `step214ug.def` inside the NX install), `nx-extractor`, `nx-analyzer`.
- A Python 3 interpreter for the analyzer.

## Script

1. Render `packages/capp-step/nx/journal.py.tpl` with absolute paths: work dir, `torus-step`, the `nx-step-settings` file, `nx-extractor`, output dir.
2. `"%UGII_BASE_DIR%\NXBIN\run_journal.exe" <work-dir>\journal.py` from a shell that inherits the system environment → exits 0 and `<out-dir>\nx-report.json` exists.
3. `<python> <nx-analyzer> <out-dir>\nx-report.json <out-dir>\analysis.json` → exits 0 and `analysis.json` exists.

## Pass criteria

Both reports are produced from the command line recorded in `packages/capp-step/README.md`.

## Runs

### 2026-11-09 · pass
- Commit: `a91f775` (branch `spike/s-nx-batch`; journal template and README are the gated artifacts)
- NX: Siemens NX 2306 (`23.06.1700.00000`, embedded Python 3.10); analyzer on Python 3.12.10. No DSH, no Mastercam.
- Assets: `torus-step`, `nx-step-settings` (NX's own `STEP214UG\step214ug.def`), `nx-extractor`, `nx-analyzer` — sha256 compared against the local asset manifest before the run (the example manifest carries placeholders for machine-local files).
- Seen:
  - `run_journal.exe journal.py` (cwd = work dir) ran the STEP214 import and the extractor; console showed the extractor's V7 banner, `Bodies: 1`, `Corrected B-Rep topology/loops: READY`. `nx-report.json` appeared in the output dir with the expected top-level keys.
  - The analyzer CLI (`main_v3`) wrote `analysis.json` and `analysis.log`; part family `axisymmetric_hollow_stepped_part`, 6 turning features.
  - Env: `UGII_BASE_DIR`, `UGII_LANG=simpl_chinese`, `SPLM_LICENSE_SERVER` were already system env vars; `UGS_LICENSE_BUNDLE` unset and not needed. No registry recovery was required.
  - Total wall time about 2.5 minutes (NX part ~2 min, analyzer ~20 s).
  - Note: `python` on PATH is a nonfunctional WindowsApps alias on this machine; the analyzer was run with the per-user Python 3.12 interpreter by absolute path.
- Not run: none.
- Evidence kept locally (never committed): `s-nx\run1\out\nx-report.json`, `s-nx\run1\out\analysis.json`, `s-nx\run1\out\analysis.log`, `s-nx\run1\extraction\` (extractor JSON and log).
