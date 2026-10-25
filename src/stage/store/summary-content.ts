/**
 * Perf-silly-fast.md R5, Phase 3 step 3.2: what a piece's sealed summary holds and how content-store
 * computes it. One function, `buildSummary`, turns a live entity into the opaque `SummaryInput` every
 * write stamps: `summaryOfPiece` (studio/store-listing.ts) for the listing fields, plus
 * `studio/piece-facts.ts` for the body-derived shelf meta the Library fetches today per kind
 * (piece-peek.ts, lore/regex/persona-shelf-ops.ts). `DERIVED_VERSION` is this function's own version
 * tag: bump it whenever the shape below changes, so a stale row is rebuilt
 * instead of read as current. Summaries hold only what lists need, never a full body.
 */
import { isRecord, type Rec } from "../../core/guards";
import { slowRuleCount } from "../../core/regex";
import type { LorebookBody } from "../../entities/lorebook/schema";
import type { PersonaBody } from "../../entities/persona/schema";
import type { RegexRule, RegexSetBody } from "../../entities/regex/schema";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import { roughTokenCount } from "../../core/tokens/estimate";
import { filledCardFields, loreFacts, personaFacts, presetFacts, promptFormatParts, doesWhatForSet, writtenChars } from "../../studio/piece-facts";
import { summaryOfPiece } from "../../studio/store-listing";
import type { PieceSummaryContent, RegexShelfFacts, SummaryInput } from "../contracts/content-store";

// Re-exported: this is still where the shape is computed, so existing readers of it (tests included)
// need not know it now lives in the shared contracts file (step 3.3, so `content-store.ts`'s new
// summary-derived readers can reference the same shape without importing this file's runtime code).
export type { PieceSummaryContent, RegexShelfFacts } from "../contracts/content-store";

/** Bump on any change to the shape below or the functions it calls: a stale stamp triggers D2's rebuild. */
export const DERIVED_VERSION = "2";

const MAX_DESCRIPTION = 400;
const truncate = (s: string): string => (s.length > MAX_DESCRIPTION ? `${s.slice(0, MAX_DESCRIPTION)}…` : s);

const regexFacts = (body: RegexSetBody): RegexShelfFacts => {
  const rules: readonly RegexRule[] = Array.isArray(body.rules) ? body.rules : [];
  return {
    enabled: body.enabled !== false,
    ruleCount: rules.length,
    enabledRuleCount: rules.filter((r) => r.enabled !== false).length,
    doesWhat: doesWhatForSet(body),
    slowCount: slowRuleCount(body),
  };
};

/** Every fact the Library and Scenes read from a live entity's body today, computed once at write time. */
export function summaryContentOf(entity: ParsedCanonicalEntity): PieceSummaryContent {
  // Only the listing fields the summary needs (id/kind/version/foreign already live on the row itself).
  const { name, importedAt, hasPortrait, accent, sourceFormat, sourceVariant, tags } = summaryOfPiece(
    entity.kind,
    entity.id,
    entity,
  );
  const body: Rec = isRecord(entity.body) ? entity.body : {};
  const identity: Rec = isRecord(body.identity) ? body.identity : {};
  const tagline = typeof identity.tagline === "string" ? identity.tagline : undefined;
  const rawDescription =
    entity.kind === "character"
      ? typeof identity.description === "string" ? identity.description : undefined
      : typeof body.description === "string" ? body.description : undefined;
  return {
    name,
    ...(importedAt ? { importedAt } : {}),
    ...(hasPortrait ? { hasPortrait } : {}),
    ...(accent ? { accent } : {}),
    ...(sourceFormat ? { sourceFormat } : {}),
    ...(sourceVariant ? { sourceVariant } : {}),
    ...(tags ? { tags } : {}),
    ...(tagline ? { tagline } : {}),
    ...(rawDescription ? { description: truncate(rawDescription) } : {}),
    tokens: roughTokenCount(writtenChars(body)),
    ...(entity.kind === "character" ? { filled: filledCardFields(body) } : {}),
    ...(entity.kind === "preset" ? presetFacts(body) : {}),
    ...(entity.kind === "promptformat" ? { formatParts: promptFormatParts(body) } : {}),
    ...(entity.kind === "regex" ? { regex: regexFacts(body as unknown as RegexSetBody) } : {}),
    ...(entity.kind === "lorebook"
      ? { lore: { enabled: body.enabled !== false, ...loreFacts(body as unknown as LorebookBody) } }
      : {}),
    ...(entity.kind === "persona" ? { persona: personaFacts(body as unknown as PersonaBody) } : {}),
  };
}

/** The opaque, stamped summary every write hands the backend (spec "Sealed piece summaries"). */
export function buildSummary(entity: ParsedCanonicalEntity): SummaryInput {
  return { text: JSON.stringify(summaryContentOf(entity)), derivedVersion: DERIVED_VERSION };
}
