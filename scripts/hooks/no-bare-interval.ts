/**
 * Bare setInterval guard: src/ui and src/kit/render may
 * not call setInterval directly. A renderer timer with no visibility gate is exactly the CPU-while-
 * idle bug this phase closes. Every repeating timer routes through useVisibleInterval
 * (src/ui/_shared/use-visible-interval.ts), which stops while the tab is hidden and, given an
 * element, while it is off screen. A short allowlist covers server-side code that happens to live
 * under src/ui and is not a renderer timer at all.
 *
 * TEST FILES ARE OUT OF SCOPE ON PURPOSE. A test harness's own fake clock (a "bare interval" control
 * proving a mocked clock is honest, say) never ships and never costs a user's CPU; the guard is about
 * runtime renderer code, not test doubles that happen to live beside it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walk } from "./walk";
import { INTERVAL_SKIP_DIRS } from "./file-selection";

const ROOTS = [join(import.meta.dir, "../../src/ui"), join(import.meta.dir, "../../src/kit/render")];
const EXTS = new Set([".ts", ".tsx"]);

/**
 * Files allowed a bare setInterval, and why. Every entry needs a reason a reviewer can check.
 *
 * THE KIT TERMINAL PRIMITIVES ARE NOT DOM CODE. the scale design's table lists these
 * nine files under "Kit animations... CSS animations where possible; otherwise useVisibleInterval",
 * but src/kit/render is Kit's own opentui terminal renderer (see its per-file jsxImportSource
 * pragma), a second JSX runtime with no document, no visibilitychange event, and no
 * IntersectionObserver - and no CSS, either. useVisibleInterval would either throw or (guarded)
 * simply never run, freezing every one of these animations, which the S2 brief also forbids ("Kit
 * looks must not change visibly"). This is a plan/code drift the S2 pass surfaced rather than
 * guessed past: a terminal-appropriate visibility signal (is this pane focused, is Kit's process in
 * the foreground) is a separate, opentui-specific design question for whoever owns that surface.
 */
const ALLOW: Record<string, string> = {
  "src/ui/_shared/use-visible-interval.ts": "the helper itself",
  "src/ui/agent/studio-events.ts": "server-side SSE heartbeat, one per open stream, torn down with it",
  "src/ui/server-static.ts": "dev-only reload heartbeat, kept as is",
  "src/ui/remote/lan-server.ts": "a JS string served to a paired device's own browser, not this app's renderer",
  // updates.tsx's version-switch poll carries its own interval-ok marker instead of a whole-file
  // entry, so a second, genuine bare setInterval added to that file later would still be caught.
  "src/kit/render/primitives/backstage-box.tsx": "opentui terminal renderer (jsxImportSource pragma), turn-scoped: ticks only while a turn is active, not while Kit sits idle",
  "src/kit/render/primitives/composer/composer.tsx": "opentui terminal renderer (jsxImportSource pragma); always mounted, unverified whether its interval runs while idle - flagged for the lead",
  "src/kit/render/primitives/input-bar.tsx": "opentui terminal renderer (jsxImportSource pragma); not imported by any non-test file (composer.tsx's own header says it replaces input-bar) - appears to be dead code, so its interval never runs; flagged for the lead to confirm and remove",
  "src/kit/render/primitives/nav/use-scroll-seam.ts": "opentui terminal renderer (imports @opentui/core's ScrollBoxRenderable, used only by the opentui-pragma'd app.tsx); active whenever the session view shows, i.e. while idle too - a real idle cost, needs a terminal-specific fix",
  "src/kit/render/primitives/opening-banner.tsx": "opentui terminal renderer (jsxImportSource pragma); bounded to the empty-transcript entrance animation (app.tsx's animate={turn.lines.length === 0}), not a continuous idle cost",
  "src/kit/render/primitives/playbill.tsx": "opentui terminal renderer (jsxImportSource pragma); mounted unconditionally in app.tsx, ticks continuously while idle - a real idle cost, needs a terminal-specific fix",
  "src/kit/render/primitives/status-row.tsx": "opentui terminal renderer (jsxImportSource pragma), turn-scoped: ticks only while Kit is working, not while idle",
  "src/kit/render/primitives/sweep-line.tsx": "opentui terminal renderer (jsxImportSource pragma); used by composer.tsx (live) and input-bar.tsx (dead, see above) - whether it ticks while idle depends on composer.tsx's own gating, unverified; flagged for the lead",
  "src/kit/render/primitives/thought-box.tsx": "opentui terminal renderer (jsxImportSource pragma), turn-scoped: mounted only for ThoughtBox/Rehearsal while the model reasons (app.tsx), not while idle",
};

const isGuardedFile = (_path: string, name: string): boolean => {
  const dot = name.lastIndexOf(".");
  return dot !== -1 && EXTS.has(name.slice(dot)) && !/\.(test|spec)\.tsx?$/.test(name);
};

/** The repo root, so hits and the allowlist read the same short path either way it is run from. */
const REPO_ROOT = join(import.meta.dir, "../..").replace(/\\/g, "/");

export function bareIntervalHits(): string[] {
  const hits: string[] = [];
  for (const rawPath of ROOTS.flatMap((r) => walk(r, isGuardedFile, INTERVAL_SKIP_DIRS))) {
    const path = rawPath.replace(/\\/g, "/").replace(`${REPO_ROOT}/`, "");
    if (ALLOW[path]) continue;
    const lines = readFileSync(rawPath, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/\bsetInterval\s*\(/.test(line) && !line.includes("interval-ok")) {
        hits.push(`${path}:${i + 1}  ${line.trim().slice(0, 100)}`);
      }
    });
  }
  return hits;
}

if (import.meta.main) {
  const hits = bareIntervalHits();
  if (hits.length > 0) {
    console.error(`bare setInterval outside useVisibleInterval (${hits.length}):\n${hits.join("\n")}`);
    process.exit(1);
  }
  console.log("no bare setInterval outside useVisibleInterval");
}
