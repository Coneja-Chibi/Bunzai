/** Shared regex-set extraction and embedding for preset dialects that carry bundled rows. */
import type { AdapterOutput } from "../../core/adapter";
import { isRecord, type Rec } from "../../core/guards";
import type { CanonicalRegexSet } from "../../entities/regex/schema";
import { bundledRowsFromRegexSet, regexSetFromBundledRows } from "./regex";

export function extractRegexFromPreset(raw: unknown, name: string): CanonicalRegexSet | null {
  if (!isRecord(raw) || !isRecord(raw.extensions)) return null;
  return regexSetFromBundledRows(raw.extensions.regex_scripts, `${name} regex`);
}

export function embedRegexIntoPreset(
  base: AdapterOutput,
  sets: readonly CanonicalRegexSet[],
): AdapterOutput {
  const rows = sets.flatMap(bundledRowsFromRegexSet);
  if (!rows.length || typeof base.text !== "string") return base;
  const out = JSON.parse(base.text) as Rec;
  const extensions = isRecord(out.extensions) ? { ...out.extensions } : {};
  extensions.regex_scripts = rows;
  out.extensions = extensions;
  return { text: JSON.stringify(out, null, 2), suggestedExtension: base.suggestedExtension };
}
