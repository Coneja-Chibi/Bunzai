/**
 * Data builders for the perf harness (`perf-gate.ts`, `perf-browser.ts`). Two data sets:
 *
 * - The **budget data** (`CARDS`, `CHATS`, `MESSAGES`, `card`, `reply`, `portraitMedia`) is exactly
 *   what `perf-gate.ts` measured before this split: 5,000 cards of a few KB each, 20 chats of 250
 *   messages. It stays byte-for-byte the same so `perf:check` keeps passing on today's code. Do not
 *   grow it to close the realism gap; that is what the realistic data below is for, wired in by
 *   whichever later phase makes its assertion pass.
 * - The **realistic data** (`REALISTIC_CARD_COUNT`, `realisticCard`, `realisticSnapshotMedia`,
 *   `FOUR_K_MESSAGE_COUNT`) matches what a large real library holds: 1 to 3 MB character
 *   bodies, a ~20 MB frozen snapshot, and a 4,000-message chat. Today its only consumer is
 *   `perf-browser.ts`'s sandbox seed. A future phase's server-bench gate (R5, R6, R8, R9's open-count
 *   and total-time budgets) reads from here too, kept to a few hundred pieces so the gate stays under
 *   about 20 s.
 */
import { CANONICAL_SCHEMA_VERSION } from "../src/core/canonical";

export const reply = "She traced the rim of the lantern with one gloved finger, listening to the rain. ".repeat(12);

/** A data-URI portrait of about `chars` characters of base64, the shape every card's media carries. */
export function portraitMedia(chars: number): { portrait: { role: "portrait"; ref: string } } {
  return { portrait: { role: "portrait", ref: `data:image/png;base64,${"A".repeat(chars)}` } };
}

// --- Budget data: unchanged from the pre-split perf-gate.ts, so perf:check's pass/fail is unchanged. ---

export const CARDS = 5_000;
export const CHATS = 20;
export const MESSAGES = 250;
/** The 1.5 MB portrait every budget-data chat's frozen card carries. */
export const BUDGET_PORTRAIT_CHARS = 1_500_000;

export const card = (i: number) => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "character",
  id: `card-${i}`,
  body: { identity: { name: `Card ${i}`, description: reply.repeat(6) }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
});

// --- Realistic data: 1 to 3 MB bodies, a ~20 MB snapshot, a 4k-message chat. ---

/** "A few hundred pieces" (plan section 5, Phase 0), sized so a future gate stays under ~20 s. */
export const REALISTIC_CARD_COUNT = 300;
/** The size of the base64 portrait in a big frozen snapshot: about 20 MB, the plan's worst case. */
export const REALISTIC_SNAPSHOT_PORTRAIT_CHARS = 20_000_000;
/** A scene long enough to reproduce the plan's 4k-message measurements (B8, B9, R9). */
export const FOUR_K_MESSAGE_COUNT = 4_000;

/**
 * A character body between 1 and 3 MB once sealed, by index: the description text scales with
 * `i % 5` so the set is not uniform, closer to a large library (average 3.4 MB, some outliers).
 */
export function realisticCard(i: number) {
  const targetChars = 1_000_000 + (i % 5) * 450_000; // 1.0 MB .. 2.8 MB of description text
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "character",
    id: `realistic-card-${i}`,
    body: {
      identity: { name: `Realistic Card ${i}`, description: reply.repeat(Math.ceil(targetChars / reply.length)) },
      persona: {},
      prompts: {},
      greetings: {},
      examples: {},
      media: i % 10 === 0 ? portraitMedia(400_000) : {},
      attribution: {},
      discovery: {},
    },
  };
}

/** The ~20 MB frozen snapshot media a scene's `cast_snapshot_json` carries in the worst case. */
export function realisticSnapshotMedia() {
  return portraitMedia(REALISTIC_SNAPSHOT_PORTRAIT_CHARS);
}
