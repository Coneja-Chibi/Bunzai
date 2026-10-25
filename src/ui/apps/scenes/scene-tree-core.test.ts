/**
 * The take tree's pure half: nesting, row words, what the pill menu lists for the take you are on, and the pill's sentence.
 */
import { expect, test } from "bun:test";
import type { TakeSummary } from "../../../studio/scenes";
import { affordance, menuView, takeLabel, takeMeta, takeTree } from "./scene-tree-core";

const take = (id: string, parent: string | null, extra: Partial<TakeSummary> = {}): TakeSummary => ({
  id, chatId: "c", name: parent === null ? "main" : `Take ${id}`, parentBranchId: parent, forkMessageId: parent === null ? null : "m", forkSwipeId: null,
  createdAt: Number(id.replace(/\D/g, "")) || 0, version: 1, messageCount: 4, forkPosition: parent === null ? null : 2, ...extra,
});

test("the tree nests each take under the one it forked from, oldest first, with the original at the root", () => {
  const root = takeTree([take("b3", "a1", { createdAt: 30 }), take("a1", "m0", { createdAt: 10 }), take("m0", null), take("b2", "a1", { createdAt: 20 }), take("c4", "m0", { createdAt: 40 })])!;
  expect(root.take.id).toBe("m0");
  expect(root.children.map((n) => n.take.id)).toEqual(["a1", "c4"]);
  expect(root.children[0]!.children.map((n) => n.take.id)).toEqual(["b2", "b3"]);
  expect(root.children[0]!.depth).toBe(1);
  expect(root.children[0]!.children[0]!.depth).toBe(2);
});

test("a take whose parent is gone stays on the tree, under the original, instead of vanishing", () => {
  const root = takeTree([take("m0", null), take("x9", "gone", { createdAt: 5 })])!;
  expect(root.children.map((n) => n.take.id)).toEqual(["x9"]);
});

test("no original, no tree", () => {
  expect(takeTree([take("a1", "m0")])).toBeNull();
});

test("a row reads Main Timeline for the original and the take's name otherwise; the meta counts messages and says where it forked", () => {
  expect(takeLabel(take("m0", null))).toBe("Main Timeline");
  expect(takeLabel(take("a1", "m0", { name: "The quiet one" }))).toBe("The quiet one");
  expect(takeMeta(take("m0", null, { messageCount: 1 }))).toBe("1 message");
  expect(takeMeta(take("a1", "m0", { messageCount: 7, forkPosition: 3 }))).toBe("7 messages · Branched at msg 3");
  expect(takeMeta(take("a1", "m0", { messageCount: 7, forkPosition: null }))).toBe("7 messages");
});

test("on the original the menu lists its takes; on a take it lists the siblings, the parent when that is not the original, and the take's own sub-takes", () => {
  const all = [take("m0", null), take("a1", "m0", { createdAt: 10 }), take("a2", "m0", { createdAt: 20 }), take("b3", "a1", { createdAt: 30 }), take("c4", "b3", { createdAt: 40 })];
  expect(menuView(all, "m0")).toMatchObject({ parent: null, alternates: all.filter((t) => t.id === "a1" || t.id === "a2"), subs: [] });
  const onA1 = menuView(all, "a1");
  expect(onA1.parent).toBeNull();
  expect(onA1.alternates.map((t) => t.id)).toEqual(["a1", "a2"]);
  expect(onA1.subs.map((t) => t.id)).toEqual(["b3"]);
  const onB3 = menuView(all, "b3");
  expect(onB3.parent?.id).toBe("a1");
  expect(onB3.alternates.map((t) => t.id)).toEqual(["b3"]);
  expect(onB3.subs.map((t) => t.id)).toEqual(["c4"]);
});

test("the pill's sentence says which take you are on and what to do next, with RoleCall's words", () => {
  expect(affordance(true, 0)).toBe("You are on the Director's Cut, the main take. Branch from any message to make another one.");
  expect(affordance(true, 1)).toBe("You are on the Director's Cut, the main take. 1 other take to switch to.");
  expect(affordance(true, 3)).toBe("You are on the Director's Cut, the main take. 3 other takes to switch to.");
  expect(affordance(false, 2, "Take 2")).toBe("You are on Take 2, an alternate take. 2 other takes to switch to.");
});
