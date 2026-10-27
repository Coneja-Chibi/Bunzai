/**
 * What a piece says about itself: the peek fetch behind the close-up views and the shelf's
 * metadata facts (rough tokens, content tags, filled card fields, the source-format chip label).
 * Split from index.tsx by the one-concept-per-file cap; pure except the one tolerant getEntity.
 * The pure fact functions themselves live in src/studio/piece-facts.ts,
 * so content-store can compute the same facts without importing UI code.
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { PiecePeek } from "./view-contract";
import { roughTokenCount } from "../../../core/tokens/estimate";
import { kindFacts, writtenChars } from "../../../studio/piece-facts";
import { isRecord } from "../../../core/guards";

/**
 * A piece's own words + shelf metadata for close-up views. Perf-silly-fast.md R5 step 3.3: read
 * straight off `e.facts` (its sealed summary) when the listing already carries it, never a body
 * fetch; only a piece whose summary predates this listing (a save/create/restore response, not yet
 * re-listed) falls back to `getEntity`. Tolerant either way (null on failure).
 */
export async function peekPiece(ctx: AppContext, e: StudioEntitySummary): Promise<PiecePeek | null> {
  if (e.facts) {
    const f = e.facts;
    return {
      tagline: f.tagline,
      description: f.description,
      tokens: f.tokens ?? 0,
      tags: e.tags,
      filled: f.filled,
      samplers: f.samplers,
      blocks: f.blocks,
      samplerSet: f.samplerSet,
      formatParts: f.formatParts,
    };
  }
  try {
    const entity = (await ctx.api.getEntity(
      `kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}`,
    )) as { body?: unknown };
    const body = isRecord(entity.body) ? entity.body : {};
    const identity = isRecord(body.identity) ? body.identity : {};
    const discovery = isRecord(body.discovery) ? body.discovery : {};
    const rawTags = e.kind === "character" ? discovery.tags : body.tags;
    const tags = Array.isArray(rawTags)
      ? rawTags.filter((t): t is string => typeof t === "string" && t.length > 0)
      : [];
    /**
     * A character's words are its IDENTITY description (the card's `description`, see
     * entities/character/schema.ts); a preset's or a book's are the body's own. This read
     * persona.description, a field no importer writes, so no card ever showed its description.
     */
    const description =
      e.kind === "character"
        ? typeof identity.description === "string" ? identity.description : undefined
        : typeof body.description === "string" ? body.description : undefined;
    return {
      tagline: typeof identity.tagline === "string" ? identity.tagline : undefined,
      description,
      tokens: roughTokenCount(writtenChars(body)),
      tags: tags.length > 0 ? tags : undefined,
      ...kindFacts(e.kind, body),
    };
  } catch {
    return null;
  }
}

/**
 * "RoleCall · V3" / "CC V2" from the summary's source fields; null = made from scratch. The
 * generic Tavern reader's "Default" label meant nothing on a card chip - a plain character card
 * is a CC (character card) of some spec version, so say that.
 */
export function sourceLabelFor(
  formatLabels: Map<string, string>,
  e: StudioEntitySummary,
): string | null {
  if (!e.sourceFormat) return null;
  const base = formatLabels.get(e.sourceFormat) ?? e.sourceFormat;
  const variant = e.sourceVariant?.toUpperCase();
  if (base === "Default") {
    // CC means CHARACTER card. On a preset or a book from the generic reader it named the wrong
    // thing; those say nothing here, and search still finds them by their raw format.
    if (e.kind !== "character") return null;
    return variant ? `CC ${variant}` : "CC";
  }
  return variant ? `${base} · ${variant}` : base;
}
