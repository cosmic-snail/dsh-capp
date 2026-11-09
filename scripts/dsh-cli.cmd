@echo off
rem Run the Harness CLI bundled with DSH Desktop through its Electron runtime in Node mode,
rem the way Desktop launches it (docs/development.md#harness-from-the-command-line).
rem DSH_HOME must point at a development home, never at Desktop's own profile.
setlocal
if not defined DSH_HOME (echo DSH_HOME is not set; point it at a development home such as %LOCALAPPDATA%\capp-dev\dsh-home 1>&2 & exit /b 2)
if not defined DSH_DESKTOP_DIR set "DSH_DESKTOP_DIR=%LOCALAPPDATA%\Programs\DSH Desktop"
set "R=%DSH_DESKTOP_DIR%\resources"
set ELECTRON_RUN_AS_NODE=1
set NO_COLOR=1
set "DSH_DESKTOP_PNPM_ENTRY=%R%\app.asar\node_modules\pnpm\bin\pnpm.cjs"
set "DSH_DESKTOP_PNPM_RUNNER=%R%\app.asar\node_modules\dsh-desktop-market-installer\pnpm-runner.mjs"
"%DSH_DESKTOP_DIR%\DSH Desktop.exe" --expose-internals "%R%\harness-node-entry.mjs" "%R%\app.asar\node_modules\@deepseek-ai\dsh\lib\bin.js" %*
