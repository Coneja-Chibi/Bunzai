/**
 * `inspect`'s per-kind summary: each kind's own `describe` lines (src/entities/<kind>/kind.ts), indented, then a blank
 * line. A new kind needs no edit here.
 */
import type { ParsedCanonicalEntity } from "./entities/runtime-schema";
import { kindOf } from "./generated/kinds";

/** Print what is worth knowing about one parsed entity. */
export function printEntitySummary(ent: ParsedCanonicalEntity, log: (line: string) => void): void {
  const lines = kindOf(ent.kind)?.describe(ent.body) ?? [];
  lines.forEach((line, i) => log(`    ${line}${i === lines.length - 1 ? "\n" : ""}`));
}
