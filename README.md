# dsh-capp

AI-native computer-aided process planning (CAPP) on [DSH Desktop](https://github.com/dataelement/dsh-desktop).

A set of DSH Desktop plugins that let the Harness agent take a part from **STEP → process plan → (human approval) → Mastercam CAM → NC → (human review)**, using DSH Desktop's own conversation and workbench panel as the UI.

Status: **design / MVP**. Target: one fixed torus part end to end on Windows. See [docs/design.md](docs/design.md) for intent and [docs/spec.md](docs/spec.md) for the engineering spec.

## Packages (planned)

| Package | Role |
|---|---|
| `capp-common` | JSON Schemas, types and the job store, bundled into each plugin |
| `capp-step` | STEP → `part.json` via NX |
| `capp-planning` | Process plans: template-fill and freeform modes |
| `capp-cam` | Mastercam runs → NC |
| `capp-workbench` | Business panel with approval buttons |
| `bridge/mastercam` | C# script templates sent to Mastercam over its named pipe |

## Assets are not in this repository

Part data, CAM templates, post-processors, NX scripts and vendor SDKs are private or vendor-licensed. See [docs/assets.md](docs/assets.md) and `assets/manifest.example.json`.

## Development

Agents and humans start at [AGENTS.md](AGENTS.md). After cloning, run `pnpm install` and `node scripts/check.mjs install-hooks` once (Node 22.13 or newer, pnpm 10.34.5). Checks, the git hook and CI are described in [docs/development.md](docs/development.md); current state is in [docs/status.md](docs/status.md).

## License

MIT
