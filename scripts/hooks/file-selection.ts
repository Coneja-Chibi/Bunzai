/** Pure source extensions and distinct skip-directory policies shared by repository file walkers. */
export const SOURCE_EXTS = new Set([".ts", ".tsx"]);
export const SKIP_DIRS = new Set(["node_modules", "dist", "samples", "fixtures", "_fixtures", "generated", "vendor"]);
export const LINE_SKIP_DIRS = new Set(["node_modules", "dist"]);
export const INTERVAL_SKIP_DIRS = new Set(["node_modules"]);
export const PROSE_SKIP_DIRS = new Set(["node_modules", "dist", "samples", "fixtures", "generated", "vendor"]);
