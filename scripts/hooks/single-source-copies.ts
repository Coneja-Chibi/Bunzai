/**
 * Single-source guards for small value helpers whose copies kept drifting: JSON coercions, magic-byte
 * sniffing, archive bounds, platform-ownership predicates and role tables. Same contract as
 * single-source-core.ts: pure (path, source) -> message | null, comments stripped, home exempt. The
 * live-repo scan sits in single-source-core.test.ts so one command covers every single-source rule.
 */
import { norm, stripComments } from "./lib";

const isTest = (p: string): boolean => /\.test\.tsx?$/.test(p);
/** Fixtures and builders legitimately spell out file signatures to MAKE bytes, not to sniff them. */
const isFixture = (p: string): boolean => /(^|\/)_?fixtures?\/|-fixtures?\.tsx?$|\.fixtures?\.tsx?$/.test(p);

/** Arrays of strings are read with strArray / presentStrArray, never a hand-written filter ternary. */
export function strArrayCopyOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (p === "src/core/guards.ts") return null;
  // `Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []` (or `: undefined`), x being a
  // name or a property/index path repeated on both sides.
  const copy = /Array\.isArray\(\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])*)\s*\)\s*\?\s*\1\s*\.filter\(\s*\(\s*(\w+)\s*\)\s*:\s*\2\s+is\s+string\s*=>\s*typeof\s+\2\s*===?\s*["']string["']\s*\)\s*:\s*(?:\[\s*\]|undefined)/;
  if (!copy.test(stripComments(source))) return null;
  return `${p}: filters an unknown array down to strings by hand. Use strArray (or presentStrArray when absent must stay undefined) from src/core/guards.ts.`;
}

/** isRecord(x) ? x : {} is recOr. Plain identifiers only, so a property path is never forced. */
export function recOrCopyOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (p === "src/core/guards.ts") return null;
  if (!/\bisRecord\(\s*(\w+)\s*\)\s*\?\s*\1\s*:\s*\{\s*\}/.test(stripComments(source))) return null;
  return `${p}: coerces a value into a plain object by hand. Use recOr from src/core/guards.ts.`;
}

/** A (value, fallback) boolean reader is boolOr, whatever the local name. */
export function boolOrCopyOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (p === "src/core/guards.ts") return null;
  const reader = /\(\s*\w+\s*:\s*unknown\s*,\s*\w+\s*:\s*boolean\s*\)\s*:\s*boolean\s*=>\s*\(?\s*typeof\s+(\w+)\s*===?\s*["']boolean["']\s*\?\s*\1\s*:/;
  if (!reader.test(stripComments(source))) return null;
  return `${p}: declares a boolean-or-fallback reader. Use boolOr from src/core/guards.ts.`;
}

/** ZIP and PNG signatures are spelled once, in core/bytes.ts, so every sniffer agrees on length and shape. */
export function magicBytesOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (!p.startsWith("src/") || isTest(p) || isFixture(p) || p === "src/core/bytes.ts") return null;
  const clean = stripComments(source);
  const has = (re: RegExp): boolean => re.test(clean);
  const zip = has(/\b0x50\b/i) && has(/\b0x4b\b/i);
  const png = (has(/\b0x89\b/i) && (has(/\b0x50\b/i) || has(/\b0x4e\b/i))) || /\b137\s*,\s*80\s*,\s*78\s*,\s*71\b/.test(clean);
  if (!zip && !png) return null;
  return `${p}: spells out a ${zip ? "ZIP" : "PNG"} signature. Use isZipBytes / isPngBytes / startsWith from src/core/bytes.ts.`;
}

/** Card-sized archive bounds are applied by unzipCard; a caller passing them to unzipBounded is a copy. */
export function cardArchiveBoundsOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (p === "src/core/archive.ts" || isTest(p)) return null;
  if (!/\bbounds\s*:\s*CARD_ARCHIVE_BOUNDS\b/.test(stripComments(source))) return null;
  return `${p}: passes CARD_ARCHIVE_BOUNDS to unzipBounded. Use unzipCard from src/core/archive.ts.`;
}

/** Profile ownership (core keys, the "full" union, then per-profile extras) is one function in write-for.ts. */
export function platformOwnsBodyOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (p === "src/core/write-for.ts") return null;
  const clean = stripComments(source);
  if (!/\bprofile\s*===\s*["']full["']\s*\)\s*return\s+true/.test(clean) || !/\.includes\(\s*key\s*\)/.test(clean)) return null;
  return `${p}: re-implements platform field ownership. Build the predicate with makePlatformOwns from src/core/write-for.ts.`;
}

/** The ST injection-role table (0 system, 1 user, 2 assistant) lives in formats/_shared/lore-enums.ts. */
export function roleTableOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (p === "src/formats/_shared/lore-enums.ts") return null;
  const clean = stripComments(source);
  const intTable = /\b0\s*:\s*["']system["']\s*,\s*1\s*:\s*["']user["']|\bsystem\s*:\s*0\s*,\s*user\s*:\s*1\b/.test(clean);
  const nameTable = /===\s*["']user["']\s*\?\s*["']user["']\s*:\s*\w+\s*===\s*["']assistant["']\s*\?\s*["']assistant["']\s*:\s*["']system["']/.test(clean);
  if (!intTable && !nameTable) return null;
  return `${p}: re-declares the injection role table. Use parseRole / roleToNumber / parseRoleName from src/formats/_shared/lore-enums.ts.`;
}

/** "3 books": a count with its noun is plural() in core/text.ts; a function named plural/pluralize is a copy. */
export function pluralCopyOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (p === "src/core/text.ts") return null;
  const clean = stripComments(source);
  // A function-valued `plural` / `pluralize`; a plain variable that happens to be called plural (a deck's
  // plural noun, an "s" suffix) is not a copy.
  const helper = /\b(?:function\s+(?:plural|pluralize)\s*\(|(?:const|let)\s+(?:plural|pluralize)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\(|function\b|\w+\s*=>))/;
  if (!helper.test(clean)) return null;
  return `${p}: declares an "N thing(s)" helper. Use plural from src/core/text.ts.`;
}

/** Lowercase a-z0-9 slugs (runs collapse to one - or _) come from asciiSlug in core/text.ts. */
export function slugCopyOutsideHome(path: string, source: string): string | null {
  const p = norm(path);
  if (p === "src/core/text.ts") return null;
  if (!/\.replace\(\s*\/\[\^a-z0-9\]\+\/g\s*,\s*["'][-_]["']\s*\)/.test(stripComments(source))) return null;
  return `${p}: collapses non-alphanumerics into a slug by hand. Use asciiSlug from src/core/text.ts.`;
}
