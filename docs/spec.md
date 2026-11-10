# DSH-CAPP MVP engineering spec

Status: v0 · 2026-11-08 · Scope: the torus MVP defined in [design.md](design.md). Where this spec and the design doc disagree, **this spec wins** for engineering decisions, and the design doc wins for product intent.

Contents: §1 tech stack and environment · §2 architecture · §3 directory topology and module boundaries · §4 core interfaces · §5 key flows · §6 coding standards and guardrails · §7 implementation plan and acceptance gates · §8 open spikes

---

## 1. Tech stack and environment constraints (locked)

### 1.1 Host

| Item | Locked value | Notes |
|---|---|---|
| Host app | DSH Desktop from [dataelement/dsh-desktop](https://github.com/dataelement/dsh-desktop), official release **v0.13.2**, unchanged | No CAPP code in the host. A host change only for a bug we can't work around: it goes into a fork of dataelement/dsh-desktop and is recorded in `docs/host-patches.md` |
| Harness packages | `@deepseek-ai/dsh-*` **0.2.2-alpha.2** (exact) | Matches the v0.13.2 lockfile. A host upgrade is a separate, explicit task |
| Cordis | `@deepseek-ai/cordis` **4.0.6-alpha.1** | Peer dependency only |
| Schemastery | `@deepseek-ai/schemastery` **3.18.6-alpha.1** | Plugin `Config` schemas only |
| Plugin runtime | Electron **44.7.0** in Node mode (`ELECTRON_RUN_AS_NODE=1`) | We never ship our own Node. **No native addons** in plugins |
| Client runtime | Harness web UI and its module loader | React comes from the host (`require('react')`) and is **never bundled**. Use only APIs common to React 18 and 19 (function components, hooks, `createElement`) |

### 1.2 Our toolchain

| Item | Locked value |
|---|---|
| Language | TypeScript **5.9.3**, `strict`, `noUncheckedIndexedAccess`, ESM, target ES2023 |
| Bundler | esbuild **0.25.12**: server → one ESM file per plugin; client → one IIFE file wrapped in `window.__ModuleLoader__.load` |
| Package manager | pnpm **10.34.5** workspace (the `dsh-capp` repo only; dsh-desktop keeps npm) |
| Dev Node (build, test, and lint) | Node 22 LTS, **22.13** or newer |
| Tests | vitest **4.x**, for pure modules only |
| JSON validation | ajv **8.x** (draft 2020-12), bundled into each plugin |
| Lint | ESLint **10.14.0**, typescript-eslint **8.72.1**. No formatter. Single quotes and no semicolons (§6.1), plus ESLint recommended |

`@deepseek-ai/*` packages are **peerDependencies** at the exact versions above, plus `devDependencies` for types. They are never bundled.

### 1.3 Target machine (acceptance environment)

There is exactly one supported environment: **Windows 11 x64**, an interactive desktop session, one user. On that machine:
- **DSH Desktop** v0.13.2, the official Windows x64 installer from the dataelement/dsh-desktop release.
- **Siemens NX 2306** (the version the external extractor targets). Batch invocation is decided: `run_journal.exe` (spec §8, S-NX).
- **Mastercam 2026** (SDK `C_H_VERSION 2800`), running interactively with the user signed in. The Chinese UI is the only tested UI language.
- **External assets** from the private Drive folder, synced to a local directory outside the repo (see [assets.md](assets.md)).
- **VS 2022 Build Tools** (v143, x64 MFC) and Windows SDK 10.0.22621.0. Required: spike S-MC showed the lathe CHook is unavoidable (spec §8).

Development may happen on macOS (build, unit tests, packing). **Acceptance gates are only ever passed on the Windows machine.** Machine names, addresses and credentials never appear in the repo.

### 1.4 Model

The plugins **never call an LLM**. The Harness agent, configured in DSH Desktop settings (any provider), is the only model consumer. Plugins provide tools, skills and prompt sections. This keeps the "AI-native" logic in the agent and the skills, and makes the mode A/B experiment a property of the agent, not of our code.

---

## 2. Architecture

```text
┌─────────────────────────── DSH Desktop v0.13.2 (unchanged) ───────────────────────────┐
│ Harness agent loop · sessions · workspaces · model providers · Plugin Manager        │
│                                                                                     │
│  Cordis bus (ctx): tools · skills · systemPrompt · connection.fetch · subprocess     │
│                                                                                     │
│ ┌───────────┐  ┌──────────────┐  ┌───────────┐  ┌─────────────────────────────────┐ │
│ │ capp-step │  │ capp-planning│  │ capp-cam  │  │ capp-workbench                  │ │
│ │ tools     │  │ tools+skills │  │ tools     │  │ server: /api/capp/* endpoints   │ │
│ │ +skill    │  │              │  │ runner    │  │ client: business panel          │ │
│ └────┬──────┘  └──────┬───────┘  └────┬──────┘  └──────────────┬──────────────────┘ │
│      │   all bundle capp-common (schemas, job store, helpers) — no runtime coupling │
└──────┼─────────────────┼──────────────┼────────────────────────┼────────────────────┘
       │                 │              │                        │
       ▼                 ▼              ▼                        ▼
   NX 2306 batch     (pure TS)     Mastercam 2026  ◄── named pipe ── C# scripts (bridge/)
       │                                │
       └────────── job directory: <workspace>/capp/<job-id>/ (the shared state) ─────────┘
                    + index: <DSH_HOME>/capp/jobs.json  (job id → absolute dir)
```

### Architectural decisions

| # | Decision | Rationale |
|---|---|---|
| A1 | **Files are the only shared state.** Plugins don't call each other or provide Cordis services to each other | No load-order coupling; every step can be inspected and re-run; the agent can read the same files |
| A2 | **`capp-common` is bundled into each plugin at build time**, not installed | The host's loader is strict about resolution; bundling avoids cross-plugin dependency resolution entirely |
| A3 | **Approval writes happen only in `capp-workbench` HTTP endpoints**, called by panel buttons | Approval is human-only by construction: no tool exists that can write it |
| A4 | **Jobs live in the session workspace**, with a global index under `DSH_HOME` | The agent sees the files in its workspace, and the panel finds jobs through the index without depending on unconfirmed client workspace APIs |
| A5 | **CAM runs are background tasks** in the `capp-cam` process, one at a time, with progress in `status.json` | Mastercam can do one thing at a time; tool calls must not block for minutes. Spike S-JOBS decides whether the host `jobs` service replaces our runner |
| A6 | **Mastercam is driven from Node over its own named pipe**, by sending C# scripts generated from templates in `bridge/mastercam/`; lathe parameters go through a C++ CHook invoked from those scripts | No PowerShell layer; S-MC proved C# alone cannot reach lathe operation parameters |
| A7 | **The plugins have no LLM code** (§1.4) | Keeps the intelligence in the agent and skills |

---

## 3. Directory topology and module boundaries

```text
dsh-capp/
├── package.json              # private workspace root: scripts lint/build/test/pack
├── pnpm-workspace.yaml       # packages/*
├── tsconfig.base.json
├── scripts/
│   ├── build.mjs             # esbuild: server + client for every plugin
│   └── pack.mjs              # pnpm pack each plugin → dist/*.tgz
├── packages/
│   ├── capp-common/          # NOT a plugin. Bundled by the others.
│   │   ├── schemas/*.schema.json      # capp.part|plan|approval|cam-request|cam-status|nc-review|template/v0
│   │   ├── src/types.ts               # TS types matching the schemas
│   │   ├── src/docs.ts                # readDoc / writeDoc (validation + atomic write)
│   │   ├── src/jobs.ts                # createJob / openJob / listJobs (index)
│   │   ├── src/paths.ts               # inside(), jobPath()
│   │   ├── src/tool.ts                # cappTool() wrapper over defineTool
│   │   └── test/
│   ├── capp-step/            # plugin (server only)
│   │   ├── src/index.ts               # apply(): register step_parse + skill
│   │   ├── src/nx.ts                  # runExtractor() via ctx.subprocess
│   │   ├── src/normalize.ts           # NX reports → Part (pure)
│   │   ├── skills/read-part/SKILL.md
│   │   └── cordis.patch.yml
│   ├── capp-planning/        # plugin (server only)
│   │   ├── src/index.ts
│   │   ├── src/templates.ts           # load templates from templatesDir
│   │   ├── src/plan.ts                # fromTemplate / applyEdits / validatePlan / renderCard (pure)
│   │   ├── skills/plan-torus-template/SKILL.md
│   │   ├── skills/plan-freeform/SKILL.md
│   │   └── cordis.patch.yml
│   ├── capp-cam/             # plugin (server only)
│   │   ├── src/index.ts
│   │   ├── src/request.ts             # buildRequest (pure)
│   │   ├── src/runner.ts              # single-slot background runner
│   │   ├── src/mastercam.ts           # pipe client
│   │   ├── src/nc.ts                  # read/diff helpers (pure)
│   │   └── cordis.patch.yml
│   └── capp-workbench/       # plugin (server + client)
│       ├── src/server.ts              # /api/capp/* endpoints
│       ├── src/client/                # React panel (built to lib/client.js)
│       └── cordis.patch.yml
├── bridge/mastercam/
│   ├── scripts/*.csx.tpl              # C# script templates sent over the pipe
│   └── README.md                      # SDK calls used, the reference bridge it was learned from
├── fixtures/                          # synthetic, publishable only (no real torus data)
├── assets/manifest.example.json
└── docs/ (design.md, spec.md, assets.md, host-patches.md, experiments/)
```

### Dependency rules (enforced by review)

1. `capp-common` imports nothing from other `capp-*` packages and nothing from `@deepseek-ai/*` except **types** and `dsh-tools` (inside `tool.ts`).
2. Capability plugins import only `capp-common` and host peers. They **never import each other**.
3. `capp-workbench` imports `capp-common` for types and docs I/O. It never imports a capability plugin.
4. Pure modules (`normalize.ts`, `plan.ts`, `request.ts`, `nc.ts`) import no Node APIs except `node:crypto`, and no `ctx`. They're the only ones with unit tests.
5. Only `nx.ts`, `mastercam.ts` and `runner.ts` touch external processes.

---

## 4. Core interface signatures

### 4.1 `capp-common`

```ts
// types.ts — mirrors schemas/*.schema.json (design §6)
export type DocName = 'part' | 'plan' | 'approval' | 'cam-request' | 'cam-status' | 'nc-review'
export interface Docs { part: Part; plan: Plan; approval: Approval; 'cam-request': CamRequest; 'cam-status': CamStatus; 'nc-review': NcReview }
export interface Issue { level: 'error' | 'warn'; op_id?: string; message: string }

// jobs.ts
export interface Job { id: string; dir: string }               // dir is absolute
export function createJob(workspaceRoot: string, label?: string): Promise<Job>   // id: job-<yyyymmdd>-<4 hex>
export function openJob(id: string): Promise<Job>              // via <DSH_HOME>/capp/jobs.json
export function listJobs(): Promise<Array<Job & { label?: string; updated_at: string }>>

// docs.ts — hard check #1 lives here
export function readDoc<N extends DocName>(job: Job, name: N, file?: string): Promise<{ doc: Docs[N]; sha256: string }>
export function writeDoc<N extends DocName>(job: Job, name: N, doc: Docs[N], file?: string): Promise<{ path: string; sha256: string }>
//   write = JSON.stringify(doc, null, 2) → <file>.tmp → rename. No locks.

// paths.ts
export function inside(root: string, rel: string): string       // resolves; throws if outside root

// tool.ts — every CAPP tool goes through this
export function cappTool<A, R>(spec: {
  name: `${'step' | 'plan' | 'cam' | 'nc'}_${string}`
  description: string
  parameters: Record<string, unknown>   // dsh-tools parameter schema
  timeoutMs: number
  concurrencySafe?: boolean
  run: (args: A, exec: ToolExec, log: Logger) => Promise<R>
}): ReturnType<typeof defineTool>
//   adds: presentCall card, JSON render, error → `CappError` message + log path, one info log per call
export class CappError extends Error { constructor(message: string, readonly log?: string) }
```

### 4.2 `capp-step`

```ts
export const Config = Schema.object({
  nxRoot: Schema.string().required(),
  extractorScripts: Schema.object({ extractor: Schema.string().required(), analyzer: Schema.string().required() }),
  timeoutMs: Schema.natural().default(600_000),
})
// nx.ts
export function runExtractor(ctx: Context, cfg: Config, stepAbs: string, outDir: string, signal: AbortSignal)
  : Promise<{ reports: string[]; log: string }>
// normalize.ts (pure)
export function normalize(reports: Array<{ name: string; json: unknown }>, source: { file: string; sha256: string }): Part
```

Tool: `step_parse({ step_path, job_id? }) → { job_id, part_path, summary, warnings }` (design §7.1).

### 4.3 `capp-planning`

```ts
export const Config = Schema.object({ templatesDir: Schema.string().required() })
// plan.ts (pure)
export function fromTemplate(part: Part, tpl: Template, overrides?: Edit[]): Plan
export function applyEdits(plan: Plan, edits: Edit[], reason: string): Plan        // revision + 1, appends changes[]
export function validatePlan(plan: Plan, tpl?: Template): Issue[]                   // hard check #3 → 'error'; all else 'warn'
export function renderCard(plan: Plan): string                                      // markdown table
export type Edit = { op_id: string; action?: 'set' | 'remove' | 'move'; param?: string; value?: unknown; seq?: number }
```

Tools: `plan_templates_list`, `plan_from_template`, `plan_write`, `plan_revise`, `plan_validate`, `plan_show` (design §7.2). On a write, the previous `plan.json` is copied to `plan.r<n>.json`.

### 4.4 `capp-cam`

```ts
export const Config = Schema.object({
  mastercamExe: Schema.string().required(),
  assets: Schema.object({ templateMcam: Schema.string().required(), post: Schema.string().required() }),
  workDir: Schema.string().required(),                // scratch for csx and mcam copies
  stepTimeoutMs: Schema.natural().default(900_000),
})
// request.ts (pure) — hard check #2 lives here
export function buildRequest(plan: Plan, planSha: string, approval: Approval, cfg: Config, steps: CamStep[]): CamRequest
//   throws CappError('plan changed since approval') unless approval.plan.sha256 === planSha
// mastercam.ts
export interface MastercamPipe {
  connect(signal: AbortSignal): Promise<void>         // finds the running Mastercam pid → \\.\pipe\MastercamPipe<pid>
  runScript(csxPath: string, timeoutMs: number, signal: AbortSignal): Promise<string>  // returns script stdout/reply
  close(): void
}
// runner.ts
export interface CamRunner {
  start(job: Job, req: CamRequest): Promise<{ run_id: string }>   // throws if a run is active (one slot)
  status(job: Job, runId: string, waitSeconds?: number): Promise<CamStatus>
  cancel(job: Job, runId: string): Promise<CamStatus>
}
// nc.ts (pure)
export function sliceLines(text: string, from: number, count: number): { total_lines: number; lines: string[] }
export function diffNc(a: string, b: string, maxLines: number): string
```

Bridge script contract: each `*.csx.tpl` receives absolute paths only (`request.json`, run dir, MCAM copy, post). It writes `bridge-<step>.json` (`{ ok, message, data }`) into the run dir and prints one line `CAPP_DONE <path>`. The runner turns these into `status.json`.

### 4.5 `capp-workbench`

```ts
// server endpoints: exact paths under /api/capp; ids and options go in the query string
GET  /api/capp/ping                                      → { ok: true }          // S0 only, removed in S4
GET  /api/capp/jobs                                      → { jobs: [{ id, label, updated_at }] }
GET  /api/capp/job?id=                                   → { part?, plan?, revisions: number[], approval?, runs: CamStatus[], nc_review? }
GET  /api/capp/plan?id=&revision=                        → Plan
GET  /api/capp/nc?id=&run=&from=&count=                  → { total_lines, lines }
POST /api/capp/approve?id=          { revision }         → Approval        // writes approval.json
POST /api/capp/nc-review?id=        { run, decision, note } → NcReview
// client
register({ title: 'CAPP', customFrame: true, headerLayout: 'compact' }, CappPanel)   // tabs: Part · Process card · NC
```

`connection.fetch.register` matches the exact pathname only (Harness 0.2.2-alpha.2, `@deepseek-ai/dsh-client-connection`), so a path segment such as `:id` is literal text, not a parameter. The `/api/capp/` prefix follows workbench standard §3.4 (endpoints under the workbench's own prefix). The host's own workbench plugin uses the same shape (`/api/desktop-workbenches/state`, `/api/desktop-workbenches/market-install`); the dot style of `dsh-image-generation` (`/api/image-generation.preview`) is a capability plugin's choice, not a rule the standard sets for workbenches. The panel polls `GET /api/capp/job?id=` every 2 s while a CAM run is `running`. No websockets.

---

## 5. Key flows

### F1: Parse

```text
user: drops ring.step, "plan this part"
agent → step_parse{step_path}
  createJob(workspace) → copy STEP to input/ → runExtractor (NX batch, timeout) → normalize → writeDoc(part)
  ← { job_id, part_path, summary, warnings }
agent: loads read-part skill as needed, summarizes the part to the user
```

### F2: Plan and revise (mode A shown; mode B swaps in `plan_write`)

```text
agent → plan_templates_list → plan_from_template{job_id,'golden-b7'} → plan.json r1 (+ issues)
agent → plan_show → quotes the process card
user: "use rough_step 0.4 on op 2"
agent → plan_revise{job_id, base_revision:1, edits:[{op_id,param:'rough_step',value:0.4}], reason}
  stale base_revision → error "plan is at r2; re-read with plan_show"
  0.4 outside template range → issue level 'error' and the revision is NOT written
  ← r2 + warnings
```

### F3: Approve (human only)

```text
panel Process card tab shows r2 → user clicks Approve
POST /approve {revision:2} → server reads plan.json, sha256 → writes approval.json
agent learns of it when the user says so or calls plan_show (which reports approval status)
```

### F4: CAM run

```text
agent → cam_generate{job_id}
  readDoc(plan) + readDoc(approval) → buildRequest (hard check #2) → runner.start → { run_id, state:'queued' }
runner (background): copy template MCAM → pipe.connect → for step in [regen, post]:
  render csx from template → runScript → read bridge-<step>.json → update status.json
  success → program.nc in run dir; failure → status.failed {message, log}; no retry
agent → cam_status{job_id, run_id, wait_seconds:60} (repeats until terminal)
agent → nc_read / nc_diff to explain the output
```

### F5: NC review (human only)

```text
panel NC tab shows run list and NC text → user clicks Approve NC / Reject → POST /nc-review → nc-review.json
```

---

## 6. Coding standards and defensive guardrails

### 6.1 Style

- Match the host's house style: two-space indent, single quotes, no semicolons, named exports, kebab-case files, camelCase functions, PascalCase types.
- TypeScript `strict` with no `any`. Use `unknown` plus a schema check at the boundaries (files, tool args, HTTP bodies, pipe replies). No non-null assertions.
- Small modules with one responsibility each. Comments explain *why* and the host or vendor quirks, not *what*.
- Logs go through `ctx.logger` as `capp-<plugin>: <event>; key=value`. Never log API keys or file contents. Absolute paths to local assets are fine in local logs, but must not end up in committed fixtures or docs.

### 6.2 Error handling

- Tools throw `CappError(message, log?)`. The message is one sentence the agent can act on ("NX exited with code 3; see capp/job-…/nx/nx.log").
- No empty catch blocks. Cleanup failures are logged and swallowed, with a comment saying why.
- There's no retry anywhere in our code. The agent or the user decides to re-run (principle 2).

### 6.3 Guardrails: the complete list

Anything not on this list is **not** added to the MVP without updating this section first.

| # | Guardrail | Where |
|---|---|---|
| G1 | Hard check: documents parse against their `schema` version (ajv) | `readDoc` / `writeDoc` |
| G2 | Hard check: CAM refuses if the approval doesn't match the current plan hash | `buildRequest` |
| G3 | Hard check: template-mode parameters stay within the template's allowed range | `validatePlan` → blocks the write |
| G4 | Path containment: tool path arguments resolve inside the session workspace; job files inside the job dir | `inside()` |
| G5 | Every subprocess and pipe call has a timeout and honors `exec.signal` | `nx.ts`, `mastercam.ts` |
| G6 | One CAM run at a time | `runner.ts` |
| G7 | No tool can write `approval.json` or `nc-review.json` | by construction (A3) |
| G8 | No assets or secrets in git | `.gitignore` + review |

### 6.4 Explicit anti-patterns (CAPPtron lessons)

These are not to be built: idempotency keys or command replay; recovery state machines; checks that bind process or window identity; evidence ledgers or hash chains beyond G2; schema-version negotiation (we just bump `/v0`); per-field provenance; multi-layer "pending" statuses; and tests that assert log text.

### 6.5 Testing

- Unit tests (vitest) cover only the pure modules: `normalize`, `plan`, `request`, `nc`, plus `docs` and `paths` in common.
- Fixtures are synthetic and hand-written (a fake two-op part and a toy template). Real torus data is never a fixture.
- Every gate (§7) has a **manual acceptance script** in `docs/acceptance/G<n>.md`: steps, expected result, and a record of the actual run (date, DSH Desktop version, what was seen). Passing the script on the Windows machine **is** the gate.
- Gates may drive the agent through the Harness command line (`headless --json` events are the evidence) on the Windows machine; steps that need the panel, including both human approvals, stay in DSH Desktop.

---

## 7. Implementation plan and acceptance gates

The order is driven by risk: the riskiest integration (Mastercam) gets spiked right after the skeleton exists.

| Step | Work | Gate (pass on the Windows machine) |
|---|---|---|
| **S0 Skeleton** | Workspace, `build.mjs`/`pack.mjs`, `capp-common` stub, `capp-workbench` with an empty panel and a `capp_ping` tool (registered by the workbench, removed in S4) | **G0:** from the Harness command line, the `.tgz` installs, the `capp-workbench` row is composed, the agent calls `capp_ping` and gets `pong`, and the web profile serves `GET /api/capp/ping`; in DSH Desktop, the `.tgz` installs via `install_local_workbench` (restart Harness only if it reports `restart-required`), and "CAPP" appears in the workbench switcher and the panel shows "Server: ok" |
| **S-MC Spike: Mastercam pipe** (time-box 2 days) | Node connects to `MastercamPipe<pid>`, sends a trivial C# script that returns the operation count of the open torus MCAM. Read the reference bridge for the regen and post API calls | **G-MC:** the script result shows the expected operation count. A written note settles C# only vs a C++ CHook, and the post-processing call path |
| **S-NX Spike: NX batch** (time-box 1 day) | Run the external extractor on the torus STEP from the command line | **G-NX:** the reports are produced; the exact command line is recorded in `capp-step/README.md` |
| **S1 Common** | Schemas, types, docs I/O, jobs index, `cappTool`, unit tests | **G1:** `pnpm test` is green; synthetic fixtures round-trip through `readDoc`/`writeDoc` |
| **S2 Step** | `capp-step` + the `read-part` skill | **G2:** in a real session, the agent parses the torus STEP; `part.json` lists the expected features; a bad path gives a clear error |
| **S3 Planning (mode A)** | `capp-planning`, the torus template file (private, from Drive) and the mode-A skill | **G3:** the agent produces the 7-op plan in Golden order; revises rough_step 0.5 → 0.4; rejects an out-of-range value with a clear message; `plan_show` renders the card |
| **S4 Workbench** | Panel tabs Part and Process card, Approve, jobs index | **G4:** the panel lists the job, shows r2, Approve writes `approval.json`; editing the plan after approval makes the panel show "not approved" |
| **S5 CAM** | `capp-cam`: runner, pipe client, regen + post scripts; NC tab and NC review in the panel | **G5:** the approved plan yields `program.nc`; doing it again at rough_step 0.4 yields a second run; `nc_diff` shows the toolpath change; a CAM run on an unapproved plan is refused |
| **S5b Simulate** (optional) | `simulate` step | **G5b:** the simulation outcome is recorded in `status.json` |
| **S6 End to end** | Polish the skills and system prompt sections only | **G6:** one fresh session with no manual file handling: STEP → plan → revise → Approve → CAM → NC → Approve NC; screen recording kept locally (not committed) |
| **S7 Mode B + experiment** | The `plan-freeform` skill, an experiment runbook, 5 + 5 runs | **G7:** `docs/experiments/planning-modes-<date>.md` committed (no proprietary numbers beyond what the open-source boundary allows); next-scope decision recorded |

Rules for every step:
- One PR per step. The PR description says what the gate run showed, or why it wasn't run.
- A step is done only when its gate passed on Windows. "Unit tests green" is never a gate by itself, except G1.
- If a spike's time-box runs out, stop and re-plan with the user. Don't push through.

---

## 8. Open spikes and decisions

| ID | Question | Decided in |
|---|---|---|
| S-MC | **Decided:** C# over the pipe covers count/open/post, but lathe operation parameters are unreachable from .NET — a C++ CHook is required for set-params and regen. Verdict and API details: `bridge/mastercam/README.md`, G-MC | S-MC |
| S-MC-STEP | `rough_step` via `u.prm_lrgh.step` writes/regens/reads back but produced no NC diff at 0.4 **or** 0.25 on the torus part/post (header-only `fc /n`), while `feed` and `stock_x` verifiably reach the NC — field mapping or geometry insensitivity unresolved. The MVP demo revision "rough_step 0.5→0.4" (design §10, G3/G5) depends on this; S5's first task is to resolve it and adjust the demo value or field | S5 |
| S-NX | **Decided:** `run_journal.exe <journal.py>` is the batch entry; it needs `UGII_BASE_DIR`, `UGII_LANG`, `SPLM_LICENSE_SERVER` (system env on the Windows machine); `UGS_LICENSE_BUNDLE` not required. Verdict and command line: `packages/capp-step/README.md`, G-NX | S-NX |
| S-JOBS | Use the host `jobs` service (`@deepseek-ai/dsh-jobs`) for CAM runs instead of our runner | During S5, only if it simplifies; the default is our runner |
| S-WS | Can the client get the current session workspace from host APIs? If yes, the panel filters jobs by workspace; if no, the global index stays | S4 |
| S-PERM | Do NX and Mastercam subprocesses need sandbox escalation (`approveEscalation`) under the session's permission mode? Also whether `ctx.sandbox.confine`/`ctx.subprocess.spawn({ env })` inherits the system NX/Mastercam environment variables | S2 |
