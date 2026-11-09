# Assets and the open-source boundary

This repository is public. Anything listed below stays **out of git**. It lives in the private Google Drive asset folder or on the Windows machine.

| Never commit | Where it lives |
|---|---|
| Golden-B7 STEP, MCAM template, readback/policy/profile JSON, template data | Private Drive folder (existing CAPPtron Golden folder) |
| NX extractor/analyzer scripts (collaborator-owned) | Private Drive folder |
| Mastercam / NX SDKs, post-processors (`.pst`) | Vendor installs on the Windows machine |
| Generated `.nc`, `.mcam`, logs, screenshots, session exports | Session workspace on the Windows machine |
| Machine names/addresses, SSH keys, API keys, rclone/Drive configs | The developer's machine only |

## Local setup

1. Sync the Drive folder in `assets/manifest.example.json` to a local directory **outside** this repo, for example `C:\capp-assets\golden-b7\20261023`. The manifest's `drive_folder` is the Drive folder **id**: when the folder can't be reached by its breadcrumb name, sync by id with `rclone --drive-root-folder-id <id>`. The folder must stay restricted to named accounts — the id alone grants nothing, but link sharing would expose the assets it contains.
2. Check each file's sha256 against the manifest. That's a quick manual check, not a build gate.
3. Point the plugin configs (`templatesDir`, `assets`, `extractorScripts`) at absolute paths in that directory.

`.gitignore` blocks the common asset extensions and `.env*` files. Before pushing, glance at `git status` for anything binary or machine-specific.
