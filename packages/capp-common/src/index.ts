// __CAPP_VERSION__ is injected by scripts/build.mjs (esbuild define) with the
// building package's version, so capp-common never hardcodes a version that can drift.
declare const __CAPP_VERSION__: string

export const CAPP_VERSION = __CAPP_VERSION__
