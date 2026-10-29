/**
 * How a Final Cut pass failure is sorted: a server refusing tools is its own class with advice that says what to change, and any other 400 stays unclassified.
 */
import { expect, test } from "bun:test";
import { createPass } from "../core/final-cut/pass";
import { ProviderError, type ProviderCompletion } from "../stage/contracts/provider";
import { classify, failureMessage, retryable } from "./final-cut-errors";
import { runFinalCut } from "./final-cut-run";
import type { Connected } from "./scene-turn";

const http400 = (message: string) => new ProviderError(message, { category: "api_error", code: "backend_error", status: 400 });

test("a server that does not support tools is classified, marked not retryable, and advised to use tagged mode", () => {
  const error = http400('Desk (400): {"error":"qwen3 does not support tools"}');
  expect(classify(error)).toBe("tools_refused");
  expect(retryable("tools_refused")).toBe(false);
  expect(failureMessage(error)).toContain("Set this pass's output mode to tagged");
});

test("any other bad request stays unclassified", () => {
  expect(classify(http400("Desk (400): model not found"))).toBe("unknown");
});

test("a pass against a server that refuses tools asks it exactly once, fails with the advice, and keeps the text", async () => {
  let asked = 0;
  const provider = { id: "fake", send: async (): Promise<ProviderCompletion> => { asked++; throw http400('Desk (400): {"error":"qwen3 does not support tools"}'); } };
  const env = { open: async (): Promise<Connected | null> => ({ provider, kind: "local", tools: true } as unknown as Connected), scene: { id: "kit1", model: "qwen3" }, context: { characterName: "Vera", recentMessages: [{ role: "user" as const, content: "hi" }] }, rulebook: [], userBanks: {}, now: () => 1_000 };
  const out = await runFinalCut({ text: "She waited.", passes: [createPass("editor")], env, signal: new AbortController().signal });
  expect(asked).toBe(1);
  expect(out.final).toBe("She waited.");
  expect(out.passes[0]!.status).toBe("failed");
  expect(out.passes[0]!.warnings[0]).toContain("Set this pass's output mode to tagged");
});
