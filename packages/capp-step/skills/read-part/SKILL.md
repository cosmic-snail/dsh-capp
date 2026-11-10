---
name: read-part
description: Interpret a capp.part/v0 part.json produced by step_parse — what the fields mean, how to treat warnings, and when to open the raw NX reports.
---

# Reading a CAPP part document

`step_parse` writes `part.json` (`capp.part/v0`) into the job directory and returns a summary. Use this skill when you need to reason about the part's geometry for planning or review.

## Fields that matter

- `features[]` — the manufacturing-relevant geometry, each `{ id, type, params }`. `type` uses the open vocabulary: `cylinder_outer`, `cylinder_inner`, `plane_face`, `groove`, `hole`, `chamfer`, `fillet`. `params` carries what the extractor measured (e.g. `diameter`, `length`, `radius` in the part's `units`).
- `bbox` — overall bounding box `{ min, max }` in `units`; `null`/absent means the analyzer found no usable bounds.
- `material` — the material name if the source part declares one, else `null`. A null material is normal for bare STEP files; don't treat it as an error.
- `units` — the length unit (`mm` for the Golden-B7 assets).
- `source` — `{ file, sha256 }` of the STEP that was parsed; quote the sha256 when a downstream step must prove it read the same file.
- `raw` — job-relative paths to the untouched NX reports (`nx/nx-report.json`, `nx/analysis.json`). Open them only when a feature looks wrong or a number needs verification; they are large.
- `warnings[]` — leads, not errors. Each entry names something the normalizer could not map or had to assume (unmapped feature type, missing material, assumed units). Mention them to the user when they affect the answer; never treat a warning as a failed parse.

## How to talk about it

Summarize the geometry and anything unusual — don't restate every feature number back to the user. If features look implausible for the part being discussed, say so and suggest re-parsing or checking the raw reports rather than silently planning from bad data.
