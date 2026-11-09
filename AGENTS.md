# Agent rules for dsh-capp

- Read `docs/design.md` (intent, file formats, tool contracts) and `docs/spec.md` (stack, boundaries, guardrails, plan) first. Update them in the same change when a contract changes. The guardrail list in spec §6.3 is closed: extend it there first, or don't add the check.
- **Never commit assets or secrets** (see `docs/assets.md`): no STEP/MCAM/PST/NC files, NX scripts, SDK files, machine addresses, keys, logs or screenshots. Refer to assets by their logical id from `assets/manifest.example.json`.
- Keep validation minimal: only the three hard checks in design §2. Prefer a warning over a block, and a rerun over recovery logic.
- Plugins follow the DSH plugin and workbench standard in the forked host (`dsh-desktop/docs/workbench-standard.*.md`). No CAPP code goes into the host fork.
- CAPPtron-core is reference only. Don't copy its code.
