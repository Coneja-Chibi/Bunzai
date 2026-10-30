/** Independent runtime owners cannot stop or answer another consumer's identically named turn. */
import { expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import { stopTurn, turnRunning } from "./scene-turn-running";
import { answerReview, awaitReview } from "./scene-turn-review";
import { answerRegex, awaitRegex } from "./scene-turn-regex";

test("Stop and busy state belong to the injected runtime", () => {
  const a = createTurnRuntime(), b = createTurnRuntime();
  const controller = new AbortController();
  a.running.set("turn", { chatId: "scene", controller });
  expect(turnRunning(b, "scene")).toBe(false);
  expect(stopTurn(b, "scene", "turn")).toBe(false);
  expect(controller.signal.aborted).toBe(false);
  expect(turnRunning(a, "scene")).toBe(true);
  expect(stopTurn(a, "scene", "turn")).toBe(true);
  expect(controller.signal.aborted).toBe(true);
});

test("review and regex answers stay with their owner when ids collide", async () => {
  const a = createTurnRuntime(), b = createTurnRuntime();
  const controller = new AbortController();
  const review = awaitReview(a, "turn", "scene", controller.signal);
  const regex = awaitRegex(a, "turn", "scene", controller.signal);
  expect(answerReview(b, "scene", "turn", { kind: "send", edits: {} })).toBe(false);
  expect(answerRegex(b, "scene", "turn", { kind: "done", texts: {} })).toBe(false);
  expect(answerReview(a, "wrong-scene", "turn", { kind: "cancel" })).toBe(false);
  expect(answerReview(a, "scene", "turn", { kind: "send", edits: {} })).toBe(true);
  controller.abort();
  expect(await review).toEqual({ kind: "send", edits: {} });
  expect(await regex).toEqual({ kind: "cancel" });
  expect(answerRegex(a, "scene", "turn", { kind: "cancel" })).toBe(false);
});
