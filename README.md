# dsh-capp

AI-native computer-aided process planning (CAPP) on [DSH Desktop](https://github.com/dataelement/dsh-desktop).

A set of DSH plugins that let the Harness agent take a part from **STEP → process plan → (human approval) → Mastercam CAM → NC → (human review)**, using DSH's own conversation and workbench panel as the UI.

Status: **design / MVP**. Target: one fixed torus part end to end on Windows. See [docs/design.md](docs/design.md).

## Packages (planned)

| Package | Role |
|---|---|
| `capp-schemas` | JSON Schemas and types for the job files |
| `capp-step` | STEP → `part.json` via NX |
| `capp-planning` | Process plans: template-fill and freeform modes |
| `capp-cam` | Mastercam runs → NC |
| `capp-workbench` | Business panel with approval buttons |
| `bridge/mastercam` | Windows Mastercam SDK add-in |

## Assets are not in this repository

Part data, CAM templates, post-processors, NX scripts and vendor SDKs are private or vendor-licensed. See [docs/assets.md](docs/assets.md) and `assets/manifest.example.json`.

## License

MIT
