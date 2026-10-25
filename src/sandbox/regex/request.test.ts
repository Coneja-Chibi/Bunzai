/** The regex worker's value-only protocol (ADR-009 item 7): what it accepts, what it refuses, and the batch form scenes use. */
import { expect, test } from "bun:test";
import { answerRegexRequest, MAX_ITEMS, MAX_RULES } from "./request";

const rule = (over: Record<string, unknown> = {}) => ({ id: "r", label: "r", find: "cat", replace: "dog", flags: "g", phases: ["display"], enabled: true, sortOrder: 0, ...over });
const opts = { phase: "display" };

test("a single text keeps its shape: the engine result comes back whole", () => {
  const r = answerRegexRequest({ runId: 1, text: "a cat", rules: [rule()], options: opts });
  expect(r).toMatchObject({ runId: 1, ok: true, result: { text: "a dog" } });
});

test("a batch answers one text per item, each run at its own depth, and nothing else", () => {
  const rules = [rule({ minDepth: 1 })];
  const r = answerRegexRequest({ runId: 2, items: [{ text: "cat", depth: 0 }, { text: "cat", depth: 1 }], rules, options: opts });
  expect(r).toEqual({ runId: 2, ok: true, texts: ["cat", "dog"] });
});

test("a batch is refused whole when it is oversized, malformed or carries a bad rule", () => {
  const bad: unknown[] = [
    { runId: 3, items: Array.from({ length: MAX_ITEMS + 1 }, () => ({ text: "x", depth: 0 })), rules: [], options: opts },
    { runId: 3, items: [{ text: 5, depth: 0 }], rules: [], options: opts },
    { runId: 3, items: [{ text: "x", depth: "0" }], rules: [], options: opts },
    { runId: 3, items: [{ text: "x".repeat(1_000_001), depth: 0 }], rules: [], options: opts },
    { runId: 3, items: [{ text: "x", depth: 0 }], rules: Array.from({ length: MAX_RULES + 1 }, () => rule()), options: opts },
    { runId: 3, items: [{ text: "x", depth: 0 }], rules: [{ id: 1 }], options: opts },
    { runId: 3, items: [{ text: "x", depth: 0 }], rules: [], options: {} },
    { runId: 3, text: "x", items: [], rules: [], options: opts },
  ];
  for (const request of bad) expect(answerRegexRequest(request)).toEqual({ runId: 3, ok: false, error: "regex-worker: invalid request" });
});
