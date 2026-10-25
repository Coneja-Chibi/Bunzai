/**
 * Single-source guards for pack picture rules and store input rules (DRY audit slices S4 and S5).
 * Same contract as single-source-core.ts: pure (path, source) -> message | null, comments stripped,
 * home exempt. The live-repo scan sits in single-source-core.test.ts.
 */
import { norm, stripComments } from "./lib";

const isTest = (p: string): boolean => /\.test\.tsx?$/.test(p);

/**
 * Which archive entries are pack pictures is decided once in core/media/pack-picture.ts: the five-type
 * extension set, the __MACOSX tree, hidden files and Thumbs.db. lumiverse-archive keeps its own cruft rule
 * because it filters every entry of an archive, not only pictures.
 */
export function packPictureRuleOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (!p.startsWith("src/") || isTest(p)) return null;
  if (p === "src/core/media/pack-picture.ts" || p === "src/formats/lumiverse-archive/source.ts") return null;
  const clean = stripComments(source);
  const junk = /__MACOSX|thumbs\\?\.db/i.test(clean);
  const set = /\(png\|jpe\?g\|gif\|webp\)/.test(clean)
    || /\bnew Set\(\s*\[\s*["']png["']\s*,\s*["']jpg["']\s*,\s*["']jpeg["']\s*,\s*["']gif["']\s*,\s*["']webp["']/.test(clean);
  if (!junk && !set) return null;
  return `${p}: spells out the pack picture rule (${junk ? "junk files" : "extension set"}). Use isPackPictureName / isPackPictureJunk / PACK_PICTURE_EXTENSIONS from src/core/media/pack-picture.ts.`;
}

/** The Windows device-name rule for a file name is part of sanitizeDownloadBase; a second regex for it is a copy. */
export function windowsDeviceNameCopyOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (!p.startsWith("src/") || isTest(p)) return null;
  if (p === "src/core/download-name.ts" || p === "src/core/canonical.ts" || p === "src/studio/path-policy.ts") return null;
  if (!/\(\s*con\s*\|\s*prn\s*\|\s*aux\s*\|\s*nul\b/i.test(stripComments(source))) return null;
  return `${p}: spells out the Windows device-name list. Name a file with sanitizeDownloadBase from src/core/download-name.ts.`;
}

/** A message's hide flag is validated by checkHidden (a validation error every door answers alike), never a bare typeof test. */
export function hiddenFlagCheckOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (!p.startsWith("src/stage/") || isTest(p) || p === "src/stage/store/scalar-rules.ts") return null;
  if (!/typeof\s+(?:\w+\s*\.\s*)?hidden\s*!==?\s*["']boolean["']|typeof\s+\w+\s*\[\s*["']hidden["']\s*\]\s*!==?\s*["']boolean["']/.test(stripComments(source))) return null;
  return `${p}: checks the hidden flag by hand. Use checkHidden from src/stage/store/scalar-rules.ts.`;
}

/** The store rules ask isWhole / checkWhole (safe integers, one bound test); a raw Number.isInteger is a second opinion. */
export function wholeNumberCheckInStoreRulesOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (!/^src\/stage\/store\/[^/]+-rules\.ts$/.test(p) || p === "src/stage/store/scalar-rules.ts") return null;
  if (!/\bNumber\.is(?:Safe)?Integer\s*\(/.test(stripComments(source))) return null;
  return `${p}: tests for a whole number by hand. Use isWhole / checkWhole from src/stage/store/scalar-rules.ts.`;
}

/** How the SQLite store spells "live swipe", "next position" and "current swipe" is src/stage/store/sqlite/swipe-sql.ts. */
export function swipeSqlOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (!p.startsWith("src/stage/store/sqlite/") || isTest(p) || p === "src/stage/store/sqlite/swipe-sql.ts") return null;
  const clean = stripComments(source);
  const live = /\bcut_at\s+IS\s+NULL\b/i.test(clean);
  const next = /coalesce\s*\(\s*max\s*\(\s*position\s*\)\s*\+\s*1/i.test(clean);
  const current = /UPDATE\s+messages\s+SET\s+current_swipe\s*=/i.test(clean);
  if (!live && !next && !current) return null;
  return `${p}: spells out swipe SQL (${live ? "live predicate" : next ? "next position" : "current swipe"}). Use LIVE, liveOf, nextPosition, appendSwipe or setCurrentSwipe from src/stage/store/sqlite/swipe-sql.ts.`;
}
