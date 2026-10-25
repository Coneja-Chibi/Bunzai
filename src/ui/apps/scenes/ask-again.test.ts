/** Ask again is offered only when the take ends on the user's message with nothing running or held. */
import { expect, test } from "bun:test";
import { canAskAgain } from "./ask-again";

const base = { lastRole: "user" as const, busy: false, connected: true, held: false };

test("offered when the take ends on a user message and the scene is idle", () => {
  expect(canAskAgain(base)).toBe(true);
});

test("not offered after a reply, with an empty take, while busy, unconnected, or with a held card", () => {
  expect(canAskAgain({ ...base, lastRole: "assistant" })).toBe(false);
  expect(canAskAgain({ ...base, lastRole: null })).toBe(false);
  expect(canAskAgain({ ...base, busy: true })).toBe(false);
  expect(canAskAgain({ ...base, connected: false })).toBe(false);
  expect(canAskAgain({ ...base, held: true })).toBe(false);
});
