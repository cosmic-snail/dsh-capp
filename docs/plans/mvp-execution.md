# MVP execution plan (handoff to the execution agent)

This plan turns [spec §7](../spec.md#7-implementation-plan-and-acceptance-gates) into work packages an agent can execute one PR at a time. It adds *how*; it doesn't change *what*. Product intent and file formats are in [design](../design.md); stack, boundaries, interfaces and guardrails are in the [spec](../spec.md). If this plan conflicts with either, they win: stop and raise the conflict in the PR instead of following the plan. What has actually merged and passed is in [status](../status.md). A task listed here is not evidence that it exists.

Read the [root AGENTS](../../AGENTS.md) before starting any package. For running checks and gates, load the [run-gates](../../.agents/skills/run-gates/SKILL.md) skill.

## 0. How to use this plan

### 0.1 Order and parallelism

```text
S0 ──► S-MC ─────────────────────────────┐
  └──► S-NX ──┐                          │
  └──► S1 ────┴─► S2 ──► S3 ──► S4 ──► S5 ──► S6 ──► S7
                                          └─► S5b (optional, after S5)
```

- S0 comes first; everything else installs through its build and pack pipeline.
- S-MC and S-NX are **time-boxed spikes** (2 days and 1 day). Run them right after S0, before the S2/S5 code they de-risk. They can run in parallel with S1.
- S1 has no Windows dependency and can start as soon as S0's workspace exists.
- One branch and one PR per package: `feat/s0-skeleton`, `spike/s-mc-pipe`, `spike/s-nx-batch`, `feat/s1-common`, `feat/s2-step`, `feat/s3-planning`, `feat/s4-workbench`, `feat/s5-cam`, `feat/s5b-simulate`, `feat/s6-e2e`, `feat/s7-mode-b`.

### 0.2 Where each kind of work happens

| Marker | Meaning |
|---|---|
| **[any]** | Can be done on any machine with Node 22 and pnpm (macOS, Linux, cloud). Typecheck and unit tests run here |
| **[W]** | Needs the Windows machine: the DSH Desktop release named in spec §1.1, plus NX and/or Mastercam and the private assets synced locally |
| **[H]** | Needs a human decision or action. The agent prepares it, states it in one message, and waits |

Gates are always **[W]**. If the executing agent has no Windows access, it finishes the [any] tasks, writes the gate script, opens the PR as *gate not run*, and hands the gate to the human. It does not mark the step done.

### 0.3 Inputs to collect once, before S0 [H]

Ask for these in one message at the start, not per step:

1. **Windows access.** Will the agent run on the Windows machine (or have a shell there), or will a human run the gates?
2. **DSH Desktop** installed on the Windows machine, with its version. Does a Harness session expose `install_local_workbench`? (Workbench standard §3.6.)
3. **Assets synced** to a local directory outside the repo, per [assets](../assets.md): the logical ids `torus-step`, `torus-mcam`, `torus-template`, `mill-turn-post`, `nx-extractor` and `nx-analyzer`, plus the NX STEP import settings file (`step214ug.def` or its equivalent, a new id `nx-step-settings`). Ask the user to fill in the missing sha256 values in their local manifest.
4. **Installed versions:** NX 2306 and Mastercam 2026, with their install directories. These go into local plugin config only, never into git.
5. **Model:** which model the DSH agent uses for the gate runs. It's recorded in gate records and the experiment.

### 0.4 Definition of done (every package)

- [ ] The code and docs change matches the spec. If a contract changed, the owning doc changed in the same PR.
- [ ] `node scripts/check.mjs docs types test` passes locally, and `pack` passes if packages changed. Report actual output, not "should pass".
- [ ] `docs/acceptance/G<n>.md` exists with preconditions, script and pass criteria, written **before** asking for review.
- [ ] The gate was run on the Windows machine and recorded as a dated run, **or** the PR says plainly that it wasn't run, why, and what remains.
- [ ] The PR uses the template. The open-source boundary checklist is ticked after reading `git status` and the full diff.
- [ ] No asset, NC text, log, screenshot, machine name or absolute local path in the diff.
- [ ] `docs/status.md` is **not** edited in the PR. It's updated after merge (docs/AGENTS rule).

### 0.5 Stop rules

Stop and ask the user, with the evidence, when:
- a spike's time-box runs out;
- a host API behaves differently from the [host facts in §1](#1-host-facts-the-plan-relies-on) and the workaround would need a host patch;
- satisfying the spec seems to need a guardrail not on the spec §6.3 list, or anything on the §6.4 anti-pattern list;
- an asset is missing or its hash doesn't match the local manifest;
- a gate fails twice for what looks like the same cause.

## 1. Host facts the plan relies on

These were read from the dataelement/dsh-desktop source at Harness `0.2.2-alpha.2`. The S0 executor confirms them on the real host. Any that turn out wrong are fixed in the S0 PR, here and in the spec.

| Fact | Source in dsh-desktop |
|---|---|
| A tool is `defineTool({ name, description, parameters, output: { schema, render }, timeoutMs, isConcurrencySafe, presentCall, execute(args, exec) })`. `parameters` is a flat map `{ name: { type, required?, description?, enum?, items? } }`. `exec` carries `agent` (with `session.header.cwd`), `signal` and `callId` | `packages/dsh-image-generation/index.js`, `packages/dsh-desktop-workbenches/local-install-tool.mjs` |
| Tools register with `ctx.tools.register(tool)`. The server entry exports `name`, `inject: string[]`, `Config` (Schemastery) and `apply(ctx, config)` | same |
| HTTP: `ctx.connection.fetch.register({ path, methods, requestBody: 'buffered', fetch: (request) => Response })`. The examples register **exact paths** and pass ids as **query parameters**, for example `/api/image-generation.preview?session=…` | `dsh-image-generation/index.js`, `client.js` |
| The panel client calls its own endpoints with plain same-origin `fetch('/api/…')` | `dsh-image-generation/client.js` |
| Skills: `ctx.skills.registerProvider(() => ({ name, list, get }))`, with a candidate `{ name, description, invocation: { modelInvocable, userInvocable }, provider, source: 'bundled', rank: BUNDLED_SKILL_RANK, locator, resourceBase }`. `get` returns the candidate plus `content` with the frontmatter stripped | `dsh-image-generation/index.js` |
| System prompt: `ctx.systemPrompt.section({ name, order, text })` | same |
| Subprocess: `ctx.sandbox.confine(argv, policy)` → plan, then `ctx.subprocess.spawn({ argv, cwd, env, signal, graceMs, stdio: { stdin, stdout: { maxBytes }, stderr: { maxBytes } } })`, then `await child.done` → `{ exitCode }`. Policy comes from `ctx.sandboxPolicy.resolve({ session })` | `packages/dsh-desktop-office/lib/template-tool.js` |
| Escalation outside the workspace sandbox: `approveEscalation({ requestedMode, effectiveMode, subject, justification }, { approver: ctx.get('approval'), agent, callId, toolName, signal })` from `@deepseek-ai/dsh-sandbox`. This shows the user an approval prompt | `local-install-tool.mjs` |
| Client file: a single file calling `window.__ModuleLoader__.load({ id, factory: (require) => ({ apply, inject }) })`. `require` resolves only the shared baseline (React, primitives…), loaded plugins and `dsh.client.external` | workbench standard §3.5 |
| Workbench `package.json` needs `dsh.bundle.patch`, `dsh.client.platform: "web"`, `dsh.client.inject` **including `dsh-desktop-workbenches`**, and `exports["./client"]`. `@deepseek-ai/*` packages are peerDependencies | workbench standard §3.2 |
| Local install: the agent calls `install_local_workbench({ path, replace })` with an absolute `.tgz` path. The result's `application` is `applied` or `restart-required`; anything else is a failure | workbench standard §3.6 |

The routing fact held: `connection.fetch.register` matches exact pathnames only, so spec §4.5 and design §7.4 now use exact `/api/capp/<name>` paths with query-string ids. The `/api/capp/` prefix stays because of workbench standard §3.4.

## 2. Conventions shared by every package

### 2.1 Package naming and identity

npm names are the folder names: `capp-common`, `capp-step`, `capp-planning`, `capp-cam`, `capp-workbench`. **Don't rename them after the first install.** The workbench's local identity is `local:<npm name>`, and renaming creates a new identity that orphans its sessions (workbench standard §2). All packages are `"version": "0.0.x"` until the MVP is done; bump the patch version on every gate run that installs a new package.

### 2.2 Plugin `package.json` shape (capability plugins)

```jsonc
{
  "name": "capp-step",
  "version": "0.0.1",
  "type": "module",
  "license": "MIT",
  "main": "./lib/index.js",
  "exports": { ".": "./lib/index.js", "./package.json": "./package.json", "./cordis.patch.yml": "./cordis.patch.yml" },
  "files": ["lib", "skills", "cordis.patch.yml", "README.md", "LICENSE"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
  "peerDependencies": {
    "@deepseek-ai/cordis": "4.0.6-alpha.1",
    "@deepseek-ai/schemastery": "3.18.6-alpha.1",
    "@deepseek-ai/dsh-tools": "0.2.2-alpha.2",
    "@deepseek-ai/dsh-skill": "0.2.2-alpha.2",
    "@deepseek-ai/dsh-sandbox": "0.2.2-alpha.2"
  },
  "devDependencies": { "capp-common": "workspace:*" }
}
```

- `capp-common` is a **devDependency**: esbuild bundles it into `lib/index.js`, so the packed `.tgz` has no runtime dependency on it (spec A2). Verify with `tar -tzf` and by reading the packed `package.json`.
- List only the peers the plugin actually imports.
- `cordis.patch.yml` holds one `insert` row whose `id` and `name` are both the package name. Config comes from the user's profile layer, not from defaults that contain paths.

The workbench additionally declares `dsh.client` (`platform: "web"`, `inject: ["dsh-desktop-workbenches", "@deepseek-ai/dsh-client-ui-conversation"]`), `exports["./client"]: "./lib/client.js"`, and the client peers it uses.

### 2.3 Build (`scripts/build.mjs`)

- **Server:** for each plugin, esbuild bundles `src/index.ts` → `lib/index.js` with `platform: 'node'`, `format: 'esm'`, `target: 'es2023'`, `bundle: true`, and `external: ['@deepseek-ai/*', 'node:*']`. Add a banner with `createRequire` only if a bundled dependency needs `require`.
- **Client (workbench only):** bundle `src/client/index.tsx` with `format: 'cjs'`, `external: ['react', '@deepseek-ai/*']`, `jsx: 'transform'` and `jsxFactory: 'React.createElement'`. Then wrap the output text:

  ```js
  window.__ModuleLoader__.load({ id: 'capp-workbench', factory: (require) => {
    const module = { exports: {} }
    ;(function (require, module, exports) { /* esbuild cjs output */ })(require, module, module.exports)
    return module.exports   // { apply, inject }
  } })
  ```

  `id` must equal the npm name. The bundle's `require('react')` resolves through the loader's `require`, so React is never bundled (spec §1.1).
- Copy `skills/` into place as is. No build step for skills.
- The root scripts are: `typecheck` = `tsc -b` (project references, `noEmit`); `test` = `vitest run`; `build` = `node scripts/build.mjs`; `pack` = `node scripts/pack.mjs`. `scripts/check.mjs` calls these four by name ([development](../development.md)).

### 2.4 Pack (`scripts/pack.mjs`)

For each plugin package (not `capp-common`), run `pnpm pack --pack-destination <repo>/dist`, then print each `.tgz` file name with its sha256. Gate records cite those hashes.

### 2.5 Code conventions (summary of spec §6; the spec is authoritative)

- TypeScript strict and ESM. Two-space indent, single quotes, no semicolons.
- The boundaries — tool args, files, HTTP bodies, pipe replies, subprocess output — arrive as `unknown` and are parsed. Use ajv for documents; for small inputs, a hand-written type guard is fine.
- Every tool goes through `cappTool` (from S1 on). Errors are `CappError(message, log?)` with one actionable sentence.
- Log lines look like `capp-<plugin>: <event>; key=value`.
- No retries, no recovery state, no locks beyond G6, and nothing from the spec §6.4 anti-pattern list.

### 2.6 How a tool finds the job and the workspace

- **Workspace root:** `exec.agent.session.header.cwd`, resolved with `realpath`. If it's missing, throw `CappError('Open this session in a workspace folder first')`.
- **New job:** `createJob(workspaceRoot)` makes `<workspace>/capp/<job-id>/` and records it in `<DSH_HOME>/capp/jobs.json`.
  - Resolve `DSH_HOME` the way the host does; check `@deepseek-ai/dsh-home-paths` in S1, and use the same function `dshHomePath()` uses in `cordis.patch.yml`.
- **Existing job:** `openJob(job_id)` reads the index. If the indexed directory no longer exists, throw `CappError('Job <id> was moved or deleted')`. Don't recreate it.

## 3. Work packages

Each package lists: **Goal · Depends on · Files · Tasks · Unit tests · Gate · Out of scope**. Tasks are numbered in the order to do them.

---

### S0 Skeleton — `feat/s0-skeleton`

**Goal.** Prove the build → pack → install → load → call loop on the real host with the thinnest possible plugin.
**Depends on.** §0.3 inputs 1–2.

**Files.**
`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `tsconfig.json` (references), `vitest.config.ts`, `scripts/build.mjs`, `scripts/pack.mjs`, `packages/capp-common/{package.json,tsconfig.json,src/index.ts}` (with `export const CAPP_VERSION = '0.0.1'` only), `packages/capp-workbench/{package.json,tsconfig.json,cordis.patch.yml,README.md,LICENSE,src/index.ts,src/client/index.tsx}`, `docs/acceptance/G0.md`.

**Tasks.**
1. [any] Root workspace: set `packageManager: "pnpm@10.34.5"` and `engines.node: ">=22"`, and add the four root scripts from §2.3. Lock with `pnpm install`.
2. [any] `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `module: "ESNext"`, `moduleResolution: "Bundler"`, `target: "ES2023"`, `jsx: "react"`, `noEmit`, `skipLibCheck`. Use `@types/node` 22. For `@types/react`, pick 18.3: the host app pins React 18.3.1, while some host plugins declare React 19 peers, so use only APIs common to both (spec §1.1).
3. [any] `capp-workbench` server (`src/index.ts`): `name = 'capp-workbench'`, `inject = ['tools']`, `Config = Schema.object({})`.
   - Register the tool `capp_ping` with `defineTool` directly (`cappTool` arrives in S1): no parameters, returns `{ pong: true, version }`.
   - Register `GET /api/capp/ping` returning `{ ok: true }` inside `ctx.inject(['connection'], …)`: the TUI and headless profiles have no `connection` service, so the route exists only where the web UI does. Routing was read from the host source: exact pathnames only (spec §4.5).
4. [any] `capp-workbench` client (`src/client/index.tsx`): `register({ title: 'CAPP', description: 'AI-native process planning (MVP)', customFrame: true, headerLayout: 'compact' }, Panel)`.
   - `Panel` renders a single `<header data-dsh-workbench-toolbar>` with the title, and a body that calls `/api/capp/ping` on mount and shows "Server: ok" or the error.
   - `inject: ['desktopWorkbenches']`, and the unregister goes into `ctx.effect` (workbench standard §3.5).
5. [any] `scripts/build.mjs` and `scripts/pack.mjs` per §2.3–2.4. `node scripts/check.mjs types test pack` must pass. Have vitest find no tests yet and exit 0 (use `passWithNoTests` in config).
6. [any] Inspect the `.tgz`: `tar -tzf dist/capp-workbench-0.0.1.tgz` lists `package.json`, `lib/index.js`, `lib/client.js` and `cordis.patch.yml`. The packed `package.json` has no `capp-common` runtime dependency.
7. [any] Write `docs/acceptance/G0.md` (script below).
8. [W] Run G0 and record it.
9. [any] Make the spec amendment from §1 if the routing fact held, and fix any host fact that turned out wrong (spec, design and this plan, in the same PR).

**Unit tests.** None. vitest runs and finds none.

**Gate G0.** See [G0](../acceptance/G0.md) (part A on the command line, part B in DSH Desktop).
**Out of scope.** Any CAPP logic, schemas or other plugins.

---

### S-MC Mastercam pipe spike — `spike/s-mc-pipe` (time-box 2 days) [W]

**Goal.** Settle how `capp-cam` drives Mastercam, and record the answer in `bridge/mastercam/README.md`. A spike merges docs, the probe scripts and a decision. It doesn't merge production code.
**Depends on.** S0 merged (for the repo layout), §0.3 inputs 3–4, and Mastercam open with the user signed in.

**Reference, read but don't copy** (CAPPtron-core, private repo, `integrations/mastercam/windows/`):
- `run.ps1` (pipe protocol):
  1. Connect to `\\.\pipe\MastercamPipe<pid>`.
  2. Read UTF-8 text until it ends with `options.` (the greeting).
  3. Write `RUN <absolute .csx path>`. The path must contain no whitespace.
  4. Read until the reply ends with `Enter next command.`.
  5. The script succeeded only if the reply starts with `Ran Successfully.`.

  Scripts report results by writing files, not through the pipe.
- `scripts/post.csx`: post-processing through the .NET API. It sets `Mastercam.Operations.OperationsManager.PostName`, checks that `NCPrompt` is false, and calls `OperationsManager.PostAllOperations(dest, false, false, false)`.
- `scripts/dispatch.csx`: how a C# script loads a C++ CHook DLL through `Mastercam.dll`'s exported `RunCHook` (`DllImport`, entry point `?RunCHook@@YA_NPEB_W_NPEAH@Z`). This is the fallback if .NET can't edit parameters.
- `native/capabilities.cpp`: the parameter edits that worked in C++, through `operation_manager(op, OPMGR_GET/…)`:
  - tool `feed` and `rpm`;
  - `clearance`, `retract` and `depth`;
  - for opcode 60 (lathe rough) only: `rough_step` = `u.prm_lrgh.step`, plus `stock_x` and `stock_z`.

  Regeneration is `OPMGR_NCI_REGEN`, after which the operation's `db.nci_flag` must be clear.

**Tasks.**
1. Write `bridge/mastercam/probes/pipe-probe.mjs` (Node, no dependencies).
   - Find the single `Mastercam.exe` pid (`tasklist /FI "IMAGENAME eq Mastercam.exe" /FO CSV /NH`).
   - Connect with `net.connect('\\\\.\\pipe\\MastercamPipe' + pid)` and follow the protocol above.
   - Use a 30 s timeout on each read, and print every reply verbatim.
2. Write `probes/count-ops.csx`, which writes `{ "file": CurrentFileName, "ops": GetOperationIDs(true).Length }` to a path baked into the rendered script. Open a **copy** of `torus-mcam` in Mastercam by hand, run the probe, and check the count against the known 7 operations (Golden order `[1,8,2,3,4,5,6]`).
3. Write `probes/open-file.csx`: open the MCAM copy from a script (`Mastercam.IO.FileManager.Open` or the 2026 equivalent). This confirms a run can start without UI clicks.
4. **Main question:** can .NET read and write the eight parameters above and regenerate? Write `probes/edit-regen.csx`:
   - read `rough_step` on the opcode-60 operation;
   - set it 0.5 → 0.4;
   - regenerate that operation;
   - read it back.

   Look for the API in the Mastercam 2026 NET-Hook reference (`Mastercam.Operations.*`, lathe operation classes).
5. If task 4 succeeds, also try `feed` and `depth` on one operation, then post with the `post.csx` approach to a temp `.nc`.
6. If task 4 fails, build the smallest C++ CHook that does the same edit and regen (VS 2022 v143, Mastercam 2026 SDK; see the reference `native/README.md` for build settings), and call it from a C# script via `RunCHook`. Record the extra toolchain requirement.
7. Write `bridge/mastercam/README.md` covering:
   - the protocol as observed;
   - the verdict, **C# only** or **C# + C++ CHook**, with the evidence;
   - for each of the eight parameters, the API used to read, write and regenerate it;
   - how a script opens a file and posts;
   - what doesn't work;
   - the language of the Mastercam UI that was used.
8. Write `docs/acceptance/G-MC.md` and record the run. Update the spec §8 S-MC row and design §11 with the verdict. If C++ is needed, update spec §1.3 to make the toolchain required.

**Pass criteria (G-MC).**
- The probe returns the operation count of the open torus copy.
- One parameter is written, regenerated and read back changed.
- One post to a temp file succeeds.
- The verdict is written up.

Don't commit any NC text or MCAM output.

**Out of scope.** The runner, the plugin and simulation.

---

### S-NX NX batch spike — `spike/s-nx-batch` (time-box 1 day) [W]

**Goal.** Get the exact command line that turns the torus STEP into the extractor and analyzer reports.
**Depends on.** §0.3 inputs 3–4.

**Reference (read, don't copy):** CAPPtron-core `src/capptron/infrastructure/nx/parsing.py`. CAPPtron ran an NX journal executable with a generated `journal.py`. That journal:
1. imports NXOpen;
2. creates a new display part;
3. imports the STEP with the STEP214 importer and a `step214ug.def` settings file;
4. loads and runs the extractor (it reads the current work part), which writes `nx-report.json`.

Then the analyzer (plain Python) runs `analyzer.py nx-report.json analysis.json`. NX also needs the environment variables `UGII_BASE_DIR`, `UGII_LANG`, `SPLM_LICENSE_SERVER` and `UGS_LICENSE_BUNDLE`; when the parent process lacks them, CAPPtron recovered them from the registry. On a timeout it killed the whole process tree (`taskkill /T /F`), because the import translator can outlive the journal.

**Tasks.**
1. Find the NX batch journal runner (for example `run_journal.exe` under the NX install) and its Python version.
2. Write `packages/capp-step/nx/journal.py.tpl`, our own journal, written from scratch. Inputs are absolute paths (the STEP, the settings file, the extractor, the output directory); it writes `nx-report.json`. Keep it under 60 lines.
3. Run it from a plain shell on the torus STEP, then run the analyzer with the plain Python the analyzer needs.
4. Record the following in `packages/capp-step/README.md`:
   - the exact argv and the environment it needs;
   - which variables had to come from the registry;
   - the run time;
   - the output file names;
   - the top-level JSON keys of both reports. Structure only: no geometry values.
5. Write `docs/acceptance/G-NX.md` and record the run. Update the spec §8 S-NX row and design §11.

**Pass criteria (G-NX).** Both reports are produced from the command line recorded in the README.
**Out of scope.** Normalization and the plugin.

---

### S1 Common — `feat/s1-common` [any]

**Goal.** Shared schemas, types and job I/O, used by every later package.
**Depends on.** S0.

**Files.** In `packages/capp-common/`:
- `schemas/{part,plan,approval,cam-request,cam-status,nc-review,template}.schema.json`;
- `src/{types.ts,docs.ts,jobs.ts,paths.ts,tool.ts,skills.ts,errors.ts,index.ts}`;
- `test/*.test.ts`.

In `fixtures/`:
- `toy-part.json`, `toy-template.json`, `toy-plan.json`. All synthetic, using made-up numbers and a two-operation part.

**Tasks.**
1. Write the JSON Schemas (draft 2020-12) exactly as in design §6.
   - `required` lists only the fields design §6 marks as required, and `additionalProperties: true` everywhere (design: extra fields are preserved).
   - `schema` is a `const`, for example `"capp.plan/v0"`.
   - **Parameter vocabulary for the MVP:** `params` is an open object, but the template schema's `rules` keys are documented as the eight Mastercam-editable parameters found in S-MC (`feed`, `rpm`, `clearance`, `retract`, `depth`, `rough_step`, `stock_x`, `stock_z`). If S-MC changes that list, S-MC's verdict wins.
2. `types.ts`: write the TS types by hand to match the schemas, as in spec §4.1. Don't add a code generator.
3. `docs.ts`:
   - `readDoc` reads the file, parses it, and validates it with ajv against the schema for `name`. That's hard check G1. On failure it throws `CappError('<file> is not a valid capp.<name>/v0: <first ajv error>')`.
   - `writeDoc` validates before writing, then writes `<file>.tmp` and renames it into place.
   - Both return the file's sha256. Compile the ajv validators once per module.
4. `paths.ts`: `inside(root, rel)` rejects absolute `rel`, `..` escapes and drive letters, and resolves symlinks with `realpath` when the target exists. This is guardrail G4.
5. `jobs.ts`: `createJob`, `openJob` and `listJobs` per §2.6.
   - The index is `{ jobs: [{ id, dir, label?, created_at, updated_at }] }`.
   - Writes follow read-modify-write order with an atomic rename. There's no lock: the last writer wins (acceptable for one user).
6. `errors.ts`: `class CappError extends Error { log?: string }`.
7. `tool.ts`: `cappTool(spec)` per spec §4.1. It:
   - wraps `defineTool`;
   - sets `presentCall: { card: 'generic', kind: 'execute', title: <name> }`;
   - renders the result as `JSON.stringify(result)`;
   - catches errors: a `CappError` is re-thrown with ` (log: <path>)` appended; anything else becomes `CappError('Internal error in <tool>: <message>')` and is logged with its stack.
   - logs one info line per call, with the tool name, duration and ok or error.
8. `skills.ts`: `registerSkills(ctx, provider, dirUrl, skills: Array<{ name, description }>)`, following the image plugin's pattern (host facts, §1).
9. `index.ts`: re-export everything.

**Unit tests.**
- `docs`: valid fixtures round-trip with a stable sha256; a missing `schema` field fails; a wrong `schema` const fails; extra fields survive.
- `paths`: `../x`, `/abs`, `C:\x` and a symlink escape are rejected; a normal path is accepted. Run on both OSes (CI Code runs Ubuntu and Windows).
- `jobs`: create, then list, then open works; opening a deleted directory throws; the id format is `job-YYYYMMDD-xxxx`.
- `tool`: error mapping (`CappError` passes through with the log appended; another error becomes "Internal error").

**Gate G1.** `pnpm test` is green locally and in CI (spec §7: G1 is the one CI-defined gate). Write `docs/acceptance/G1.md` with the CI run link and the commit.
**Out of scope.** Any plugin behavior.

---

### S2 Step — `feat/s2-step`

**Goal.** `step_parse` works in a real DSH session on the torus.
**Depends on.** S1 and G-NX.

**Files.** In `packages/capp-step/`:
- `{package.json, cordis.patch.yml, README.md, LICENSE}`;
- `src/{index.ts, nx.ts, normalize.ts, env.ts}`;
- `nx/journal.py.tpl` (from S-NX);
- `skills/read-part/SKILL.md`;
- `test/normalize.test.ts`.

Also `fixtures/nx-report.synthetic.json` and `fixtures/analysis.synthetic.json`: the same top-level structure as the real reports, filled with made-up values.

**Tasks.**
1. [any] `Config` per spec §4.2, plus `stepSettings` (an absolute path for `nx-step-settings`) and `journalRunner` (an absolute path to the NX runner found in S-NX).
2. [any] `env.ts`: build the NX environment.
   - Start from `process.env`.
   - Any of the four NX variables that is missing is read from the registry with `reg query` through `ctx.subprocess`.
   - If one is still missing, throw a `CappError` naming it.
3. [any] `nx.ts` `runExtractor`:
   1. render `journal.py.tpl` into `<job>/nx/`;
   2. spawn the journal runner with a timeout and `exec.signal`;
   3. send stdout and stderr to `<job>/nx/nx.log`;
   4. on a timeout or abort, kill the process tree with `taskkill /PID <pid> /T /F`;
   5. run the analyzer;
   6. return the report paths.

   A non-zero exit gives `CappError('NX exited with code <n>', '<job>/nx/nx.log')`.
4. [any] `normalize.ts` (pure): map the two reports to `Part`.
   - Use the open feature vocabulary in design §6.1.
   - Anything that doesn't map goes into `warnings[]`; it never blocks.
   - Take `bbox` and `material` when present, and set them to null otherwise.
   - List both raw report paths in `raw`.
5. [any] `index.ts`:
   - register `step_parse` with `cappTool`, using `timeoutMs` from config plus 30 s;
   - register the `read-part` skill;
   - add a system prompt section: "To read a STEP part, call step_parse; load the read-part skill to interpret part.json."
6. [any] `step_parse` flow:
   1. `inside(workspaceRoot, step_path)`;
   2. `createJob` (or `openJob(job_id)`);
   3. copy the STEP to `input/`;
   4. `runExtractor`;
   5. `normalize`;
   6. `writeDoc(job, 'part', part)`;
   7. return `{ job_id, part_path, summary, warnings }`.
7. [W] **S-PERM:** run inside a session and see whether `ctx.sandbox.confine` lets the NX runner execute and write into the job directory.
   - If it does, keep it.
   - If it doesn't, call `approveEscalation` with `requestedMode: 'danger-full-access'` and the justification "Run NX to read the STEP file; NX lives outside the workspace". The user sees one approval prompt per call.

   Record the outcome in the spec §8 S-PERM row.
8. [any] `skills/read-part/SKILL.md` covers:
   - what each field means;
   - that `warnings` are leads, not errors;
   - when to open the raw reports;
   - and that the agent shouldn't restate every number to the user, just summarize the geometry and anything unusual.
9. [any] Write `docs/acceptance/G2.md`. [W] Run it.

**Unit tests.** `normalize` on the synthetic fixtures: expected feature types, unknown feature → a warning, missing material → null.

**Gate G2 (outline).**
1. Install `capp-step` (and the S0 workbench) → after a restart, a CAPP session can see the tool.
2. Put the torus STEP in the session workspace and say "Parse this part" → `step_parse` runs (with an approval prompt if S-PERM required one) and `capp/<job>/part.json` exists.
3. The feature list matches what the user expects of the torus. The human judges this; record the counts by type.
4. Ask it to parse a path that doesn't exist → a clear one-line error, and no job directory is created.

**Out of scope.** Panel display of the part (that's S4).

---

### S3 Planning (mode A) — `feat/s3-planning`

**Goal.** The agent creates, shows, revises and validates the seven-operation torus plan.
**Depends on.** S1 (S2 for the real `part.json`).

**Files.** In `packages/capp-planning/`:
- `{package.json, cordis.patch.yml, README.md, LICENSE}`;
- `src/{index.ts, templates.ts, plan.ts}`;
- `skills/plan-torus-template/SKILL.md`;
- `test/plan.test.ts`.

**Private, not in git:** `golden-b7.template.json` (`capp.template/v0`), authored in task 2 and stored with the other assets.

**Tasks.**
1. [any] `templates.ts`: load every `*.template.json` in `templatesDir` with `readDoc`-style validation against the template schema. `plan_templates_list` returns the summaries.
2. [W][H] **Author the torus template** on the Windows machine. Read the private `torus-template` source and the MCAM operation ids found in S-MC, then write `golden-b7.template.json`:
   - `operations[]` in Golden order `[1,8,2,3,4,5,6]`, each with `cam.mcam_op`;
   - default `params`;
   - `rules` for each editable parameter (`min`, `max`, `step`, `editable`). `rough_step` must allow 0.4 and 0.5.

   The human confirms the operation names and ranges. Store the file in the private asset folder, add its sha256 to the local manifest, and add the id `torus-template-capp` to `manifest.example.json` (id and file name only).
3. [any] `plan.ts`, as pure functions per spec §4.3:
   - **`fromTemplate`:** copy operations and params, apply the overrides, set `revision` 1, `mode` "template" and `part.sha256`.
   - **`applyEdits`:** `set`, `remove` and `move` (renumber `seq` contiguously); bump `revision`; append to `changes[]`.
   - **`validatePlan`:** `error` only for G3 (a parameter outside its rule range, or a non-editable parameter changed). The `warn` cases are:
     - an operation without `cam.mcam_op`;
     - duplicate `seq`;
     - an operation that refers to a feature id not in the part;
     - a plan whose part sha doesn't match the current `part.json`.
   - **`renderCard`:** a markdown table with Seq, Op, Type, Tool, the key params and Notes.
4. [any] Tools via `cappTool`, per design §7.2.
   - `plan_revise` checks that `base_revision` equals the latest revision; otherwise it throws "Plan is at r<n>; call plan_show and retry". If validation returns any `error`, it doesn't write and returns the issues.
   - On a successful write, the old `plan.json` is copied to `plan.r<n>.json` first.
   - `plan_show` also reports approval status: "approved r<n>" if `approval.json` matches the current sha, "approval is for r<m>" if it's stale, or "not approved".
   - `plan_write` (mode B) is **not** registered yet; it's added in S7.
5. [any] `skills/plan-torus-template/SKILL.md` covers:
   - when to use the template (the part looks like the torus: ring, turned, single setup);
   - the call sequence `plan_templates_list` → `plan_from_template` → `plan_show`;
   - how to phrase revisions as edits;
   - and that the agent **can't approve**: approval is the Approve button in the CAPP panel.
6. [any] Add a system prompt section: "Process plans: use the planning tools; never claim a plan is approved unless plan_show says so."
7. [any] Write `docs/acceptance/G3.md`. [W] Run it.

**Unit tests (toy template).**
- `fromTemplate` gives the expected operations.
- `applyEdits` with set, remove and move produces the right revision and renumbered seq.
- A value outside the range gives an `error`; a missing `mcam_op` gives a `warn`.
- `renderCard` matches a snapshot of the toy plan.

**Gate G3 (outline).**
1. In the G2 job, say "Make a process plan for this part" → plan r1 with 7 operations in Golden order, and the card is quoted.
2. "Use rough step 0.4 on the roughing operation" → r2, with the change visible in `plan_show`.
3. "Set rough step to <a value outside the range>" → refused with the range in the message; the plan stays at r2.
4. "Approve it" → the agent explains that approval is the panel's Approve button and doesn't claim it's approved.

**Out of scope.** The panel, CAM and mode B.

---

### S4 Workbench — `feat/s4-workbench`

**Goal.** The panel shows the job, the part and the process card, and the human Approve works.
**Depends on.** S3. Uses the S0 package.

**Files.** In `packages/capp-workbench/`:
- `src/server.ts` (endpoints);
- `src/client/{index.tsx, Panel.tsx, PartTab.tsx, PlanTab.tsx, api.ts}`;
- `test/server.test.ts` for the pure request handlers, with handlers taking `(job, body)` so they can be tested without the host.

**Tasks.**
1. [any] Remove `capp_ping` and `/api/capp/ping`.
2. [any] Endpoints per spec §4.5, in the path style S0 settled.
   - `approve` reads the current `plan.json` and checks that `revision` equals the requested revision. If they differ, it returns 409 "The plan changed; review r<n>". It then writes `approval.json` with the plan's sha256. This is the **only** writer (G7).
   - The response bodies are the documents themselves.
3. [any] **S-WS:** check whether the client can learn the current session workspace from host client services (`@deepseek-ai/dsh-client-ui-workspace`).
   - If it can, filter the job list to that workspace.
   - If it can't, list all indexed jobs, newest first.

   Record the result in the spec §8 S-WS row.
4. [any] Panel: a job picker plus the tabs **Part** and **Process card**. The **NC** tab is a placeholder until S5.
   - **Part tab:** a summary and the feature table.
   - **Process card tab:** a revision picker, an operations table built from the same columns as `renderCard` (as React, not markdown), and an approval badge (approved, stale or not approved).
   - The **Approve rN** button is shown only on the latest revision and asks for confirmation.
   - The layout responds to the container width (workbench standard §4): the table scrolls horizontally inside its own box.
   - With no job, the panel shows "No CAPP jobs yet — start a session and drop a STEP file", with no automatic session creation (workbench standard §6).
5. [any] Embed the host `conversation` node (custom frame, workbench standard §4.1). The business view comes first; the conversation is on demand.
6. [any] Write `docs/acceptance/G4.md`. [W] Run it.

**Unit tests.** Approve handler: a matching revision writes the approval with the right sha; a stale revision gives 409. The NC-review handler waits for S5.

**Gate G4 (outline).**
1. Open the CAPP panel → the G3 job is listed, and the Part and Process card tabs show r2.
2. Click Approve r2 and confirm → the badge reads "approved r2", and `plan_show` in the session says the same.
3. Ask the agent to revise again → r3; the panel badge shows "approval is for r2"; the Approve button now offers r3.
4. Narrow the window and collapse and expand the sidebar → no clipped controls or page-wide horizontal scroll.

**Out of scope.** CAM and NC.

---

### S5 CAM — `feat/s5-cam`

**Goal.** An approved plan produces `program.nc` through Mastercam, and the panel shows the NC with human review.
**Depends on.** S4 and G-MC (the verdict decides whether there's a C++ CHook).

**Files.**
- `packages/capp-cam/{package.json, cordis.patch.yml, README.md, LICENSE}`
- `packages/capp-cam/src/{index.ts, request.ts, runner.ts, mastercam.ts, scripts.ts, nc.ts}`
- `packages/capp-cam/test/{request,nc,runner}.test.ts`
- `bridge/mastercam/scripts/{open.csx.tpl, apply-params.csx.tpl, regen.csx.tpl, post.csx.tpl}`
- CHook sources only if G-MC requires them: `bridge/mastercam/chook/`, with its build documented in its README; its build output is gitignored.
- In `capp-workbench`: `src/client/NcTab.tsx`, plus server handlers for `nc` and `nc-review`.

**Tasks.**
1. [any] `request.ts`: `buildRequest`, per spec §4.4.
   - It enforces G2: the approval's plan sha must equal the current plan sha; otherwise it throws "Plan r<n> isn't approved (approval is for r<m>)".
   - It maps each operation to `{ mcam_op, params }` and includes only the parameters in the Mastercam-editable list from G-MC.
2. [any] `scripts.ts`: render the `.csx` templates by substituting absolute paths that are escaped for C# verbatim strings. The rendered scripts go into a whitespace-free scratch directory (the protocol requires a path without whitespace).
   - At startup, check `workDir` contains no whitespace.
   - Each script writes `bridge-<step>.json` = `{ ok, message, data }` to the run directory.
3. [any] `mastercam.ts` `MastercamPipe`, implementing the protocol from S-MC:
   - find exactly one pid; if there are zero or several, throw "Open exactly one Mastercam window";
   - per-read timeouts;
   - `exec.signal` support;
   - no retries.
4. [any] `runner.ts`: a single slot, which is G6.
   - `start` creates `cam/run-<k>/` with `k` = the highest existing run number + 1, writes `request.json` and `status.json` (`queued`), and runs the steps in the background.
   - For each step, it renders the script, calls `runScript`, reads `bridge-<step>.json`, and updates `status.json` (`state`, `step`).
   - On success, it copies the posted NC to `program.nc` and sets `succeeded`.
   - On any failure, it sets `failed` with `{ message, log }` and stops. There's no retry and no resume.
   - `cancel` sets an abort flag that is checked between steps. Mid-step cancel isn't promised; the docs say so.
   - **S-JOBS:** spend at most half a day evaluating `@deepseek-ai/dsh-jobs`. Adopt it only if it removes code.
5. [any] Tools per design §7.3, via `cappTool`.
   - `cam_generate` returns immediately with the run id.
   - `cam_status` with `wait_seconds` polls `status.json` every second until it reaches a terminal state or the wait ends.
   - `nc_read` and `nc_diff` use the pure helpers in `nc.ts`.
6. [any] Add a system prompt section: "CAM: only for approved plans; poll cam_status; NC output is a candidate for human review in the panel's NC tab, never a manufacturing result."
7. [any] **Panel NC tab:**
   - a run list showing state, step, and the time each run started and finished;
   - an NC viewer, paged at 400 lines;
   - **Approve NC** and **Reject** buttons with a note, which write `nc-review.json` through the endpoint (G7).
   - While a run is `running`, the panel polls the job every 2 s.
8. [any] Write `docs/acceptance/G5.md`. [W] Run it.

**Unit tests.**
- `buildRequest`: an approved plan builds; a stale approval throws; non-editable parameters are dropped.
- `nc`: `sliceLines` bounds; `diffNc` truncation.
- `runner`, with a fake `MastercamPipe`: a successful sequence ends `succeeded`; a step failure ends `failed` with its message; a second `start` while a run is active throws; run numbering is correct.

**Gate G5 (outline).** Mastercam is open; the G4 job has r2 approved.
1. "Generate the NC" → `cam_generate`, then `cam_status` polling → `succeeded`; `program.nc` exists; the panel NC tab shows it.
2. Revise to r3 (rough_step 0.4) and try CAM without approval → refused with the G2 message.
3. Approve r3 in the panel and generate again → a second run, `succeeded`.
4. "What changed between the two runs?" → `nc_diff` output, and the agent's explanation mentions the roughing passes.
5. Reject run 1 and approve run 2 in the panel → `nc-review.json` is written by the panel; the agent can't do this itself.
6. Close Mastercam and try once more → a clear error, the run is `failed`, and there's no hang.

**Out of scope.** Simulation (S5b) and creating new operations.

---

### S5b Simulate (optional) — `feat/s5b-simulate` [W]

**Goal.** An optional `simulate` step whose outcome is recorded in `status.json`.
**Depends on.** S5. Start only after G6 passes without it, and only if the user asks.
**Reference (read, don't copy):** CAPPtron's simulation used UI automation of the simulator window (`integrations/mastercam/windows/probes/simulation-postprocessing/`) and depended on the Chinese UI. Time-box a fresh probe to 2 days. If there's no API path, record "not feasible without UI automation" and stop.
**Gate G5b.** A run with `steps: ["regen", "simulate", "post"]` records the simulation outcome. The panel shows it.

---

### S6 End to end — `feat/s6-e2e` [W]

**Goal.** One fresh session gets from STEP to Approve NC with no manual file handling.
**Depends on.** S5.

**Tasks.**
1. Run the full flow once and list every point of friction: the agent asks something it shouldn't, picks the wrong tool, reads too much, or the panel is confusing.
2. Fix friction **only** in skills, system prompt sections, tool descriptions and panel copy. Any code change must be a bug fix with its own unit test. No new tools, no new guardrails.
3. Write `docs/acceptance/G6.md` and run it twice, in two fresh sessions. The recording stays local.

**Gate G6.** Spec §7: STEP → plan → revise → Approve → CAM → NC → Approve NC in one fresh session. The user only talks to the agent and clicks the two panel buttons. Record the tool-call count and wall time per run.

---

### S7 Mode B and the experiment — `feat/s7-mode-b`

**Goal.** A freeform planning mode, and a mode A vs mode B report (design §9).
**Depends on.** S6.

**Tasks.**
1. [any] Register `plan_write` (design §7.2). It validates with `validatePlan` without a template, so only warnings are possible apart from schema errors; then it writes the plan.
2. [any] Write `skills/plan-freeform/SKILL.md`:
   - how to go from features to operations (facing, rough and finish turning, drilling, grooving, chamfering, cut-off);
   - how to choose the order;
   - to fill `cam.mcam_op` only when an operation clearly matches one in the template's MCAM;
   - the torus plan as **one worked example**, described in prose with its operation types and order, not the private template file.
3. [any] Write `docs/experiments/README.md` (the experiment runbook):
   - 5 fresh sessions per mode, with the same STEP, model and prompt;
   - the prompt text;
   - in mode B, the template tools are turned off by the instruction "don't use templates"; if the agent ignores that, it counts as a finding;
   - the metrics from design §9, collected from the job files and the session (tool calls, tokens if the host shows them, wall time).
4. [W] Run the 10 sessions. Record per-run results in `docs/experiments/planning-modes-<date>.md`, using operation types, order and parameter deltas in relative terms.
5. [H] The user reads the report and records the next-scope decision in the same file (design §10 M5).

**Gate G7.** The report is merged with all 10 runs, or the runs that failed with their first error, and the decision is recorded.

## 4. Risks the executor should watch

| Risk | Early signal | Response |
|---|---|---|
| .NET can't edit lathe parameters | S-MC task 4 fails | Use the C++ CHook route (S-MC task 6). It's a toolchain cost, not a design change |
| The sandbox blocks NX or Mastercam subprocesses | S2 task 7 | Use `approveEscalation` per call; record it in S-PERM |
| Exact-path routing only | S0 task 3 | Use flat query-param endpoints; amend the spec in S0 |
| The client can't see the session workspace | S4 task 3 | Use the global index list (spec A4) |
| A 10+ minute CAM step outlives the agent's patience | G5 step 1 | `cam_status` `wait_seconds` loops; the skill tells the agent to keep polling; the panel shows progress |
| The agent tries to approve on its own | G3 step 4, G5 step 5 | Skill and prompt wording only. There is no approval tool to misuse (G7) |
| Template authoring drifts from the real MCAM | G5 step 1 fails on parameter writes | Re-check `cam.mcam_op` ids against S-MC's operation list |

## 5. What the executor reports back after each package

One message per package, in this order:
1. The PR link and the commit.
2. What works now, in user-visible terms.
3. Checks run, with their actual results.
4. The gate result and its record link, or "gate not run" and why.
5. Spec or design amendments made.
6. Open questions for the user, if any.

No recap of the steps taken.
