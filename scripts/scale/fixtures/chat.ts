/**
 * Chat fixtures for the scale matrix: a scene is not a `ContentStore` piece (it stays rows, one sealed row per
 * swipe), so this exports plain data for the real `ChatStore` calls (`createChat`, `appendMessage`,
 * `addSwipe`) to drive - the same shape `scripts/perf-browser.ts`'s own seed already builds one of.
 * `chatSeed` gives the cast/snapshot a caller passes to `createChat`; `messages(n)` streams the n
 * messages to append. The plan's full scale is 4,000 messages, 3 swipes on about 10% of them, 3
 * branches, and a ~20 MB frozen cast snapshot; swipes and branches are applied by the caller through
 * the real store (they are store operations, not data this generator alone can express).
 */
import { characters } from "./character";
import { syntheticPngDataUri, mulberry32, sentence } from "./_shared";

/** The plan's full-scale message count (section 11.1). */
export const CHAT_SCALE_N = 4_000;

/** About one message in ten gets extra swipes (the plan's "3 swipes on 10%"). */
export const SWIPE_EVERY = 10;
export const SWIPES_PER_MESSAGE = 3;
export const BRANCH_COUNT = 3;

/** The `{ title, cast, snapshot }` a caller hands `ChatStore.createChat`: a frozen character carrying
 * a ~20 MB portrait, the plan's worst-case snapshot weight. */
export function chatSeed(seed = 1): { title: string; cast: { character: { id: string; version: number } }; snapshot: { character: Record<string, unknown> } } {
  const rng = mulberry32(seed);
  const card = characters(1, seed).next().value!;
  const frozen = { ...card, body: { ...card.body, media: { portrait: { role: "portrait", ref: syntheticPngDataUri(rng, 20_000_000) } } } };
  return {
    title: "Scale Scene",
    cast: { character: { id: card.id, version: 1 } },
    snapshot: { character: frozen as unknown as Record<string, unknown> },
  };
}

/** `n` alternating user/assistant messages, streamed lazily (a caller appends them one at a time). */
export function* messages(n: number, seed = 2): Generator<{ role: "user" | "assistant"; content: string }> {
  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    yield { role: i % 2 ? "assistant" : "user", content: sentence(rng, 12) + " " + sentence(rng, 12) };
  }
}
