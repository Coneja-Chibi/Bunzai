/**
 * Quick-reply fixtures for the scale matrix: a seeded, synthetic generator for ONE quick-reply-set entity with `n` buttons.
 */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import type { CanonicalQuickReplySet, QuickReply } from "../../../src/entities/quickreply/schema";
import { mulberry32, sentence } from "./_shared";

/** A moderate default scale: no figure is given for this kind in section 11.1. */
export const QUICKREPLY_SCALE_N = 300;

function reply(i: number, rng: () => number): QuickReply {
  return { id: `scale-reply-${i}`, label: `Reply ${i}`, message: `/send ${sentence(rng, 4)}` };
}

/** One quick-reply-set entity with `n` buttons. */
export function quickReplySet(n: number, seed = 1): CanonicalQuickReplySet {
  const rng = mulberry32(seed);
  const replies: QuickReply[] = [];
  for (let i = 0; i < n; i++) replies.push(reply(i, rng));
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "quickreply",
    id: "scale-quickreply",
    body: { name: "Scale Quick Replies", replies },
  };
}
