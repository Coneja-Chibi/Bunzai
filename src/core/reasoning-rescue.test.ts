/**
 * Smart Recovery (RoleCall's reasoning-rescue.ts): when a scene's recent replies carried thinking and this one carries
 * none, a helper model is asked for the first words of the visible reply, and only a verbatim, unambiguous match moves
 * the boundary. The helper never supplies text; a missing, repeated or unsafe answer leaves the reply alone.
 */
import { describe, expect, test } from "bun:test";
import { resolveReasoning } from "./reasoning-capture";
import { anchorSplit, hasHistoricalReasoning, recoveryMessages, shouldAttemptRecovery } from "./reasoning-rescue";

const auto = resolveReasoning(undefined, undefined);
const long = "The user wants a calm reply, so I will keep the tone soft and avoid anything abrupt. The harbor lights slide across the water as she watches the last ferry leave without a sound.";
const reasoned = { role: "assistant", content: "<think>t</think>Hello", model: "m" };
const plain = { role: "assistant", content: "Hello", model: "m" };

describe("when a check is worth a call", () => {
  test("the previous reply having thinking, or two of the recent eight, is a pattern that stopped", () => {
    expect(hasHistoricalReasoning([plain, reasoned], auto, "m")).toBe(true);
    expect(hasHistoricalReasoning([reasoned, plain, reasoned, plain], auto, "m")).toBe(true);
    expect(hasHistoricalReasoning([reasoned, plain, plain], auto, "m")).toBe(false);
    expect(hasHistoricalReasoning([{ ...plain, native: true }], auto, "m")).toBe(true);
    expect(hasHistoricalReasoning([{ ...reasoned, model: "other" }], auto, "m")).toBe(true);
    expect(hasHistoricalReasoning([{ ...plain, native: true, model: "other" }], auto, "m")).toBe(false);
    expect(hasHistoricalReasoning([], auto, "m")).toBe(false);
  });

  test("only in Auto, only for a reply with no thinking of its own, and not for a short one", () => {
    const history = [reasoned];
    expect(shouldAttemptRecovery({ history, content: long, format: auto, model: "m" })).toBe(true);
    expect(shouldAttemptRecovery({ history, content: long, format: { ...auto, capture: { mode: "only", custom: [], builtinTags: [] } }, model: "m" })).toBe(false);
    expect(shouldAttemptRecovery({ history, content: long, format: { ...auto, capture: { mode: "off", custom: [], builtinTags: [] } }, model: "m" })).toBe(false);
    expect(shouldAttemptRecovery({ history, content: long, format: auto, model: "m", native: "thought" })).toBe(false);
    expect(shouldAttemptRecovery({ history, content: "<think>x</think>" + long, format: auto, model: "m" })).toBe(false);
    expect(shouldAttemptRecovery({ history, content: "Short.", format: auto, model: "m" })).toBe(false);
    expect(shouldAttemptRecovery({ history: [plain], content: long, format: auto, model: "m" })).toBe(false);
  });
});

describe("the helper's answer", () => {
  test("a verbatim anchor, found once, splits the reply there and nothing is rewritten", () => {
    const at = long.indexOf("The harbor");
    const split = anchorSplit(long, "The harbor lights slide across the water");
    expect(split).toBe(at);
    expect(long.slice(0, at).trim()).toContain("keep the tone soft");
  });

  test("whitespace and case are tolerated, wrapping quotes and extra lines are dropped", () => {
    expect(anchorSplit(long, '"the harbor   lights slide\nacross the water"\nignored')).toBe(long.indexOf("The harbor"));
  });

  test("NONE, a missing anchor, one at the very start, a repeated one, or a split that leaves too little is no move", () => {
    expect(anchorSplit(long, "NONE")).toBeNull();
    expect(anchorSplit(long, "words that are not there")).toBeNull();
    expect(anchorSplit(long, "The user wants a calm reply")).toBeNull();
    expect(anchorSplit("A b c d e f. A b c d e f. rest of it goes on here", "A b c d e f")).toBeNull();
    expect(anchorSplit("Short lead. The harbor lights slide across the water", "The harbor lights slide across")).toBeNull();
  });

  test("the question is RoleCall's, sent with the reply and nothing else", () => {
    const [system, user] = recoveryMessages(long);
    expect(system!.content).toContain("conservative text-boundary classifier");
    expect(user!.content).toContain("output the single word NONE");
    expect(user!.content).toContain(long);
  });
});
