# DSH-CAPP: intent and MVP design

Status: draft v0 · 2026-11-08 · Owner: cosmic-snail · Engineering detail: [spec.md](spec.md)

## 1. Intent

Rebuild CAPPtron's process-planning workflow, **STEP → part model → process plan → human approval → Mastercam CAM → NC → human review**, as a set of plugins on DSH Desktop. The goal is an AI-native CAPP tool:

- **DSH is the product shell.** The Harness agent is the conversational and orchestration layer, and DSH's own conversation and workbench panel are the only UI. No separate web frontend.
- **Capabilities are agent tools.** Each step is a plugin that registers tools and skills on the DSH bus. The agent decides how to chain them, and you steer it in conversation.
- **Complete rebuild.** No CAPPtron-core code is reused. CAPPtron is used only as a *reference* for domain logic and for the Mastercam bridge.
- **MVP = the torus.** The fixed Golden-B7 seven-operation ring part runs end to end in one DSH session on the Windows machine that runs Mastercam.
- **Open source.** The code is public. Proprietary assets, vendor SDKs and machine details are not (see §8).

### Non-goals for the MVP

- Cross-platform. Windows only, with DSH, NX and Mastercam all on one machine.
- Arbitrary parts, multiple setups, creating new CAM operations from scratch, and choosing tools or coordinate systems.
- Crash recovery, idempotent command replay, an evidence ledger, or multi-user workflows.
- Manufacturing acceptance. NC output is a candidate for human review, and nothing more.

## 2. Principles (lessons from CAPPtron)

1. **Validate little, on purpose.** CAPPtron accumulated validation layers that made every change expensive. The MVP has exactly **three hard checks**:
   - Every file a tool reads parses against its `schema` version.
   - `cam_generate` refuses unless `approval.json` matches the current `plan.json` hash.
   - In template mode, a parameter must fall within the template's allowed range.

   Everything else is a **warning** returned to the agent and shown to the user, never a block.
2. **Failure = run it again.** CAM, NX and agent failures surface the error and the log path. There's no recovery state machine. A rerun creates a new run directory.
3. **Files are the interface.** Steps hand off through readable JSON files in the session workspace. The agent, the user and each plugin can all inspect and re-run any step.
4. **Humans own the irreversible decisions.** Approving the plan and approving the NC are panel buttons. They are never agent tools.
5. **Thin plugins, fat skills.** Domain know-how (what a torus plan looks like, how to read NX output, what a parameter means) lives in SKILL.md files the agent loads. Code does the I/O and the deterministic transforms.

## 3. The DSH bus (what we build on)

A DSH plugin is an npm package with a `cordis.patch.yml`, a server entry (`apply(ctx, config)`) and an optional web client. From `ctx`, the MVP uses:

| Service | Use |
|---|---|
| `ctx.tools.register(defineTool(...))` (`@deepseek-ai/dsh-tools`) | Agent tools with JSON schemas, timeouts, cancellation and call cards |
| `ctx.skills.registerProvider(...)` | SKILL.md files bundled with each plugin |
| `ctx.systemPrompt.section(...)` | A short standing instruction per plugin |
| `ctx.connection.fetch.register('/api/capp/...')` | HTTP endpoints for the workbench panel |
| `ctx.subprocess` / `ctx.sandbox` / `ctx.sandboxPolicy` | Running NX and the Mastercam bridge, and resolving the session workspace |
| `ctx.desktopWorkbenches.register(...)` (client) | The CAPP business panel |

Reference implementations in the forked host: `packages/dsh-image-generation`, `packages/dsh-desktop-office`, and `docs/workbench-standard.*.md`.

## 4. Packages

The repository is a pnpm workspace. Each plugin is packed to a `.tgz` and installed into the forked DSH Desktop with the local-install flow. The host fork (`dsh-desktop`) carries no CAPP code.

```text
dsh-capp/
  packages/
    capp-common/      plain package bundled into each plugin: JSON Schemas, types, job store (§6)
    capp-step/        plugin: STEP → part.json via NX
    capp-planning/    plugin: templates, plan create/revise/validate
    capp-cam/         plugin: Mastercam runs → NC
    capp-workbench/   plugin: business panel + /api/capp endpoints (the only approval writer)
  bridge/
    mastercam/        C# script templates sent to Mastercam over its named pipe (rewritten; see §7.3)
  assets/
    manifest.example.json   names + sha256 of external assets; real files live outside git
  docs/
```

The three capability plugins have **no UI**. They also work in a plain native DSH session. `capp-workbench` is a thin panel over the same files.

## 5. Workflow (torus, end to end)

```text
user drops ring.step ─► step_parse ─► part.json
                                      │
          ┌───────────── mode A ──────┴────── mode B ─────────────┐
   plan_from_template(golden-b7)                plan_write(freeform JSON)
          └──────────────► plan.json (rev n) ◄─────────────────────┘
                     ▲  plan_revise / plan_validate (agent loop with user)
                     │
        panel [Approve] ─► approval.json   (human only)
                     │
             cam_generate ─► cam/run-k/ { request.json, status.json, program.nc, logs/ }
                     │
        panel [Approve NC] ─► nc-review.json   (human only)
```

All files for one job live in `<session workspace>/capp/<job-id>/`. A job is one part. Revisions and runs are numbered inside it.

## 6. File formats (v0)

Every file carries `"schema": "capp.<name>/v0"`. Only the fields below are required, and extra fields are allowed and preserved. Paths inside files are relative to the job directory.

### 6.1 `part.json` (`capp.part/v0`)

```json
{
  "schema": "capp.part/v0",
  "source": { "file": "input/ring.step", "sha256": "…" },
  "units": "mm",
  "bbox": { "min": [0,0,0], "max": [0,0,0] },
  "features": [
    { "id": "f1", "type": "cylinder_outer", "params": { "diameter": 0, "length": 0 } }
  ],
  "material": null,
  "raw": ["nx/extractor-report.json", "nx/analyzer-report.json"],
  "warnings": []
}
```

`features[].type` is an open vocabulary for the MVP: `cylinder_outer`, `cylinder_inner`, `plane_face`, `groove`, `hole`, `chamfer`, `fillet`. The normalizer maps NX output to it and keeps the raw reports alongside.

### 6.2 `plan.json` (`capp.plan/v0`)

```json
{
  "schema": "capp.plan/v0",
  "revision": 1,
  "part": { "file": "part.json", "sha256": "…" },
  "mode": "template",
  "template": { "id": "golden-b7", "version": "2.3.0" },
  "stock": { "material": "2024-Al", "shape": "bar", "dims": { "diameter": 0, "length": 0 } },
  "setups": [
    {
      "id": "s1",
      "operations": [
        {
          "id": "op1", "seq": 1, "type": "face", "name": "…",
          "features": ["f3"],
          "tool": { "id": "T0101", "desc": "…" },
          "params": { "rough_step": 0.5, "spindle_rpm": 0, "feed": 0 },
          "cam": { "mcam_op": 1 }
        }
      ]
    }
  ],
  "notes": "",
  "changes": [ { "revision": 1, "by": "agent", "summary": "created from template" } ]
}
```

- `mode` is `"template"` or `"freeform"`. Freeform plans omit `template`.
- `cam.mcam_op` maps an operation to an existing operation in the torus MCAM file. The MVP CAM can only *update* existing operations, so a freeform plan can run CAM only if every operation maps to one (see §9).
- `revision` increases on every write. Old revisions are kept as `plan.r<n>.json`.

### 6.3 `approval.json` (`capp.approval/v0`), written only by the panel

```json
{ "schema": "capp.approval/v0", "plan": { "revision": 3, "sha256": "…" }, "approved_at": "…", "note": "" }
```

### 6.4 CAM run: `cam/run-<k>/`

- `request.json` (`capp.cam-request/v0`): `{ plan: {revision, sha256}, template_mcam: "<asset id>", post: "<asset id>", operations: [{ mcam_op, params }], steps: ["regen", "post"] }`. `"simulate"` is optional (M3b).
- `status.json` (`capp.cam-status/v0`): `{ state: queued|running|succeeded|failed, step, started_at, finished_at, nc: "program.nc"|null, error: null|{message, log} }`
- `program.nc`, `logs/`, and the output `.mcam` (kept locally, never committed).

### 6.5 `nc-review.json` (`capp.nc-review/v0`), written only by the panel

`{ run: "run-2", nc_sha256, decision: "approved"|"rejected", note, decided_at }`

### 6.6 Template library entry (`capp.template/v0`)

This is a public, generic **shape** that the private torus data fills in. It contains: `id`, `version`, `applies_to` (a feature pattern), `operations[]` with default `params`, and `rules` per parameter (`min`, `max`, `step`, `editable`). It also points to its MCAM asset. The real Golden-B7 file stays in the private asset store.

## 7. Plugin contracts and tool schemas

Every tool returns compact JSON. Errors are thrown with a one-line message plus a `log` path where there is one. Paths are relative to the session workspace unless noted.

### 7.1 `capp-step`

Config: `nxRoot` (NX install dir), `extractorScripts` (absolute paths to the external NX scripts), `timeoutMs` (default 600000).

| Tool | Input | Output |
|---|---|---|
| `step_parse` | `{ step_path, job_id? }` | `{ job_id, part_path, summary: { feature_counts, bbox, material }, warnings[] }` |

Behavior: create or reuse `capp/<job_id>/`, copy the STEP to `input/`, run NX in batch mode with the extractor scripts, normalize to `part.json`, and keep the raw reports in `nx/`.
Skill: `read-part`, which covers how to interpret `part.json` and when to look into the raw NX reports.

### 7.2 `capp-planning`

Config: `templatesDir` (absolute; holds the private template files).

| Tool | Input | Output |
|---|---|---|
| `plan_templates_list` | `{}` | `{ templates: [{ id, version, title, applies_to_summary, op_count }] }` |
| `plan_from_template` | `{ job_id, template_id, overrides?: [{ op_id, param, value }] }` | `{ plan_path, revision, issues[] }` |
| `plan_write` | `{ job_id, plan }` (freeform full plan) | `{ plan_path, revision, issues[] }` |
| `plan_revise` | `{ job_id, base_revision, edits: [{ op_id, param?, value?, action?: "set"\|"remove"\|"move", seq? }], reason }` | `{ plan_path, revision, issues[] }` |
| `plan_validate` | `{ job_id, revision? }` | `{ issues: [{ level: "error"\|"warn", op_id?, message }] }` |
| `plan_show` | `{ job_id, revision? }` | a process-card table (markdown) for the agent to quote |

- `base_revision` must match the latest revision. That keeps the agent from editing a stale plan, and it is the only concurrency control.
- `error`-level issues come only from the three hard checks in §2. Everything else is `warn`.

Skills: `plan-torus-template` (mode A) and `plan-freeform` (mode B: how to reason from features to operations, with the torus template as a worked example).

### 7.3 `capp-cam`

Config: `mastercamExe`, `assets` (absolute paths to the MCAM template and the post), `workDir`, `stepTimeoutMs`.

| Tool | Input | Output |
|---|---|---|
| `cam_generate` | `{ job_id, steps?: ["regen","post","simulate"] }` | `{ run_id, state }` (returns at once) |
| `cam_status` | `{ job_id, run_id, wait_seconds?: 0–120 }` | the contents of `status.json` |
| `cam_cancel` | `{ job_id, run_id }` | `{ state }` |
| `nc_read` | `{ job_id, run_id, from_line?, count?: ≤400 }` | `{ total_lines, lines[] }` |
| `nc_diff` | `{ job_id, run_a, run_b }` | a unified diff, truncated |

**Bridge (rewritten).** Mastercam 2026 runs interactively (it can't run headless). `capp-cam` connects from Node to Mastercam's own named pipe (`MastercamPipe<pid>`) and sends C# scripts rendered from templates in `bridge/mastercam/`. The scripts open a copy of the template MCAM, write operation parameters, regenerate toolpaths and post with the configured post-processor. They write per-step results into the run directory, and `capp-cam` turns those into `status.json` and `program.nc`. A C++ CHook is added only if spike S-MC shows the C# API can't do a step (spec §8). Single run at a time, no resume. The CAPPtron C++ CHook task (`m_main`) and the C#/UIA simulation scripts are a *reference* for which SDK calls work. They are not copied. Simulation is optional and is the last step to be built.

### 7.4 `capp-workbench`

This is a client panel (`customFrame: true`, business-first) with three tabs:
- **Part:** a summary of `part.json`.
- **Process card:** the operations table of the current revision, a revision picker, and the **Approve** button.
- **NC:** the run list, the NC viewer, and the **Approve NC / Reject** buttons.

Its server half owns the `/api/capp` endpoints (`GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/approve`, `POST /jobs/:id/nc-review`; see spec §4.5). These are the only writers of `approval.json` and `nc-review.json`. The host's native `conversation` node is embedded for AI help.

## 8. Open-source boundary

**Public (in git):** all plugin and bridge source code, JSON Schemas, generic template *shapes*, skills, docs, synthetic test fixtures, and `assets/manifest.example.json`.

**Never in git**: they live in the private Google Drive asset folder (the existing CAPPtron Drive) or on the Windows machine.

| Item | Why |
|---|---|
| Golden-B7 STEP, MCAM template, readback/policy/profile JSON, template data `v2.json` | Proprietary part and process data |
| NX extractor and analyzer scripts | Collaborator-owned; the license isn't cleared for publication |
| Mastercam/NX SDK headers, libraries and post-processors (`.pst`) | Vendor-licensed |
| Generated `.nc`, `.mcam`, logs, screenshots and session exports | They contain the proprietary geometry and process |
| Machine names or addresses, SSH keys, API keys, rclone or Drive configs | Secrets and infrastructure |

How it works:
- `assets/manifest.example.json` lists each asset's logical id, file name and sha256, plus the Drive *folder name* (not a share link).
- Each developer syncs the Drive folder to a local directory outside the repo. Plugin configs point at absolute paths in that directory.
- `.gitignore` blocks `*.step`, `*.stp`, `*.mcam`, `*.pst`, `*.nc`, `assets/*` (except the example manifest), and `.env*`. That's the only guard (principle 1).

## 9. The planning experiment (mode A vs mode B)

Both modes ship in the MVP, so we can see where the model's capability actually lies.

- **Mode A (template-fill):** the agent picks `golden-b7`, fills parameters, and revises on request. This is deterministic apart from the parameter choices.
- **Mode B (freeform):** the agent writes a plan from `part.json` features, with the torus template available only as a worked example in the skill.

To evaluate, run each mode N times (start with N = 5, with fresh sessions) and record:
1. Operation set and order versus the Golden plan (Golden order `[1,8,2,3,4,5,6]`).
2. Parameter deltas against template defaults and ranges.
3. `plan_validate` warnings.
4. Whether the plan maps onto the MCAM operations, so CAM can run it.
5. Tokens, tool calls and wall time.

The results go to `docs/experiments/planning-modes-<date>.md`. A mode-B plan that doesn't map onto the existing MCAM operations is still a valid *planning* result. It just can't reach CAM in the MVP, and that gap is itself a finding.

## 10. Milestones

| # | Deliverable | Done when |
|---|---|---|
| M0 | Repo, pnpm workspace, empty `capp-workbench` and `capp-common`, Windows dev setup notes | The panel loads in the forked DSH on the Windows machine; the asset manifest resolves locally |
| M1 | `capp-step` | The torus STEP gives a `part.json` with the expected features, called by the agent in a session |
| M2 | `capp-planning` mode A + the process-card tab + Approve | The agent creates the 7-op plan, revises rough_step 0.5 → 0.4 on request, and the user approves in the panel |
| M3 | Mastercam bridge + `capp-cam` (regen + post) | The approved plan yields `program.nc` for both rough_step values; the NC tab shows it |
| M3b | Optional `simulate` step | The simulation runs and its result is recorded in `status.json` |
| M4 | End-to-end torus demo | One session: drop STEP → … → Approve NC, with no manual file handling; a recorded walkthrough |
| M5 | Mode B + the experiment report | §9 report committed; decision on the next scope |

## 11. Open items

- Whether C# scripts over the pipe cover set-params, regen and post, or a C++ CHook is needed. Decided by spike S-MC, which runs right after M0 (spec §7).
- How NX is invoked in batch mode (`run_journal` versus the NX Python the scripts expect). Decided by spike S-NX.
- Plugin license: MIT is assumed, to match DSH Desktop.
