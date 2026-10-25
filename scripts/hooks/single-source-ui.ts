/**
 * Single-source guards for the UI folds of the 2026-10 DRY audit (section D). Same contract as
 * single-source-core.ts: pure (path, source) -> message | null, comments stripped, the home exempt;
 * the live-repo scan is in single-source-core.test.ts and these rules' fixtures in single-source-ui.test.ts.
 */
import { norm, stripComments } from "./lib";

const UI = /^src\/ui\//;
const TEST = /\.test\.tsx?$/;

/** "Is the user typing in a field?" has one predicate (A15); a hand-rolled copy misses select or nested editors. */
export function typingTargetOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (!UI.test(p) || TEST.test(p) || p === "src/ui/_shared/typing-target.ts") return null;
  const clean = stripComments(source);
  const property = /\.\s*isContentEditable\b/.test(clean);
  const closest = /\.closest\s*\(\s*["'][^"']*\b(?:input|textarea)\b/.test(clean);
  const tagName = /\btagName\b[\s\S]{0,80}?["'](?:input|textarea)["']/i.test(clean);
  if (!property && !closest && !tagName) return null;
  return `${p}: hand-rolls "is the user typing in a field". Use isTypingTarget from src/ui/_shared/typing-target.ts.`;
}

/**
 * A hand-rolled debounced autosave in an app (A3): a timer whose callback is a flush/save/write, cleared by hand,
 * in a file with effects. The timer + flush + flush-on-unmount skeleton is useDebouncedSave. Heuristic by design,
 * so it is scoped to src/ui/apps where the five scene wings lived.
 */
export function debounceFlushPatternOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (!/^src\/ui\/apps\/.+\.tsx?$/.test(p) || TEST.test(p)) return null;
  const clean = stripComments(source);
  if (!/\bsetTimeout\(\s*(?:\(\)\s*=>\s*(?:void\s+)?)?(?:flush|save|write|persist|commit)\w*/.test(clean)) return null;
  if (!/\bclearTimeout\(/.test(clean) || !/\buseEffect\(/.test(clean)) return null;
  return `${p}: hand-rolls a debounced save (setTimeout of a flush/save plus clearTimeout). Use useDebouncedSave from src/ui/_shared/use-debounced-value.ts, which also flushes when the owner closes.`;
}

/** The scene UI spells a message or version time once (B5/A13): scene-meta-core.ts owns the date forms and the finite-time guard. */
export function sceneDateFormatOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (!/^src\/ui\/apps\/scenes\//.test(p) || TEST.test(p) || p === "src/ui/apps/scenes/scene-meta-core.ts") return null;
  const clean = stripComments(source);
  if (!/\.toLocale(?:Date)?String\(\s*(?:\[\s*\]|undefined)\s*,\s*\{[^}]*\bmonth\b/.test(clean)) return null;
  return `${p}: formats a date with month/day options by hand. Use dayStamp, dateTimeStamp or formatStamp from src/ui/apps/scenes/scene-meta-core.ts, which also refuse a non-finite time.`;
}

/**
 * Timed feedback and clipboard writes in the UI (B5): the "Copied" flash, the notice and the toast timers live in
 * use-flash.ts (FLASH_MS, useFlash, useAutoDismiss), and a clipboard write goes through copyText, the one with the
 * legacy fallback and an honest answer.
 */
export function copyFlashOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (!UI.test(p) || TEST.test(p)) return null;
  const clean = stripComments(source);
  if (p !== "src/ui/_shared/clipboard.ts" && /\bnavigator\s*\.\s*clipboard\s*\??\.\s*writeText\b/.test(clean)) {
    return `${p}: writes to navigator.clipboard directly. Use copyText from src/ui/_shared/clipboard.ts (legacy fallback, and it says whether the copy worked).`;
  }
  if (p === "src/ui/_shared/use-flash.ts") return null;
  if (/\b(?:const|let)\s+[A-Z_]*(?:TOAST|COPY|NOTICE)[A-Z_]*_MS\s*=/.test(clean)) {
    return `${p}: declares its own toast/copy/notice duration. Use FLASH_MS from src/ui/_shared/use-flash.ts.`;
  }
  if (/\bsetTimeout\(\s*\(\)\s*=>\s*(?:void\s+)?set\w*\(\s*(?:false|null)\s*\)\s*,\s*(?:1_?500|2_?200|6_?000|8_?000)\s*\)/.test(clean)) {
    return `${p}: hand-rolls a timed flash. Use useFlash or useAutoDismiss from src/ui/_shared/use-flash.ts.`;
  }
  return null;
}

/**
 * Which hrefs may be followed has one policy (A7): isSafeHref for a kept anchor, safeOutwardHref for a link that
 * must leave the app. A hand-rolled scheme allowlist drifts (one copy once passed `//evil.example`).
 */
export function hrefAllowlistOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (!UI.test(p) || TEST.test(p) || p === "src/ui/_shared/render-policy.ts") return null;
  const clean = stripComments(source);
  if (!/\bSAFE_(?:LINK|SCHEME)\b|\/\^\(\?:https\?:?\|mailto:?\)/.test(clean)) return null;
  return `${p}: hand-rolls an href scheme allowlist. Use isSafeHref or safeOutwardHref from src/ui/_shared/render-policy.ts.`;
}

/**
 * A floating, draggable panel in the apps (RoleCall's Activity pop-out, `LorebookActivityFeed.tsx:747-842`) is the pop-out registry's
 * one job: register a kind in src/ui/apps/scenes/popout/ and the host gives it the panel, its clamp, its placeholder and its memory.
 * A second copy is a window listener for pointer/mouse moves that clamps against the window in a file that also portals or fixes the
 * panel. The agent's panel (src/ui/agent/) is a different thing and is out of scope.
 */
export function popoutOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (!/^src\/ui\/apps\/.+\.tsx?$/.test(p) || TEST.test(p) || p.startsWith("src/ui/apps/scenes/popout/")) return null;
  const clean = stripComments(source);
  const drag = /\baddEventListener\(\s*["'](?:pointer|mouse)move["']/.test(clean);
  const float = /\bcreatePortal\(|\bposition\s*:\s*["']?fixed/.test(clean);
  if (!drag || !float || !/\binner(?:Width|Height)\b/.test(clean)) return null;
  return `${p}: hand-rolls a floating draggable panel. Register a PopoutKind (src/ui/apps/scenes/popout/popout-kind.ts) instead; the host owns the drag, the viewport clamp, the placeholder and the memory.`;
}
