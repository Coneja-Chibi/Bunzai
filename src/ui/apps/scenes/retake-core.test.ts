/** Retake from here: which earlier replies can be retaken, and the user message each one forks at. */
import { expect, test } from "bun:test";
import type { Message } from "../../../stage/contracts/chat-store";
import { retakePoints } from "./retake-core";
import type { Row } from "./scene-page-types";

const msg = (id: string, role: "user" | "assistant"): Message => ({ id, branchId: "b1", seq: 1, role, swipes: [{ id: `${id}-s`, content: id, createdAt: 1, pinned: false }], current: 0, createdAt: 1 });
const rows = (...spec: [string, "user" | "assistant"][]): Row[] => spec.map(([id, role], i) => ({ kind: "msg", m: msg(id, role), n: i + 1 }));
const chat = rows(["g", "assistant"], ["u1", "user"], ["a1", "assistant"], ["u2", "user"], ["a2", "assistant"]);

test("an earlier reply retakes from the user message right before it", () => {
  expect(retakePoints(chat).get("a1") ?? null).toEqual({ id: "u1", n: 2 });
});

test("the last reply regenerates instead, and the greeting and user messages have no retake", () => {
  expect(retakePoints(chat).get("a2") ?? null).toBeNull();
  expect(retakePoints(chat).get("g") ?? null).toBeNull();
  expect(retakePoints(chat).get("u1") ?? null).toBeNull();
});

test("a reply not preceded by a user message has no retake point", () => {
  expect(retakePoints(rows(["g", "assistant"], ["a1", "assistant"], ["u1", "user"], ["a2", "assistant"])).get("a1")).toBeUndefined();
});

test("cut rows between are skipped, since a cut message is not in the take", () => {
  const withCut: Row[] = [...chat.slice(0, 3), { kind: "cut", id: "c", count: 1 }, ...chat.slice(3)];
  expect(retakePoints(withCut).get("a1")).toEqual({ id: "u1", n: 2 });
  expect(retakePoints(withCut).get("a2")).toBeUndefined();
});

test("an unknown id has no retake point", () => {
  expect(retakePoints(chat).get("nope") ?? null).toBeNull();
});
