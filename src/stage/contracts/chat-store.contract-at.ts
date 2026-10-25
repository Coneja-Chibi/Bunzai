/**
 * The ChatStore contract suite's absolute-ordinal read (readMessagesAt): the live, current-swipe text of
 * chosen positions, for display macros that ask for messages beyond the transcript page.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

export function chatStoreAtContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);

  describe("reading messages by live ordinal (readMessagesAt)", () => {
    test("returns each asked position with its role and current swipe text, off-page ones included", async () => {
      const { store, main } = await seeded(12);
      const tail = await store.readMessagesBefore(main, { limit: 3 });
      expect(tail.messages).toHaveLength(3);
      const page = await store.readMessagesAt(main, [0, 7, 2, 11]);
      const byIndex = new Map(page.messages.map((m) => [m.index, m]));
      expect([...byIndex.keys()].sort((a, b) => a - b)).toEqual([0, 2, 7, 11]);
      expect(byIndex.get(0)).toMatchObject({ role: "user", content: "line 1" });
      expect(byIndex.get(7)).toMatchObject({ role: "assistant", content: "line 8" });
      expect(page.branchVersion).toBe(tail.branchVersion!);
    });

    test("skips ordinals past the end and answers an empty request with the version", async () => {
      const { store, main } = await seeded(3);
      const page = await store.readMessagesAt(main, [1, 3, 50]);
      expect(page.messages.map((m) => [m.index, m.content])).toEqual([[1, "line 2"]]);
      const empty = await store.readMessagesAt(main, []);
      expect(empty.messages).toEqual([]);
      expect(empty.branchVersion).toBe(page.branchVersion!);
      expect(await store.readMessagesAt("no-such-branch", [0])).toEqual({ messages: [], branchVersion: null });
    });

    test("counts only live messages: a cut shifts the later ordinals, a restored cut shifts them back", async () => {
      const { store, main, ids } = await seeded(5);
      const cut = (await store.cutMessages(main, ids[1]!, "one"))!;
      const after = await store.readMessagesAt(main, [0, 1, 2, 3, 4]);
      expect(after.messages.map((m) => [m.index, m.content])).toEqual([[0, "line 1"], [1, "line 3"], [2, "line 4"], [3, "line 5"]]);
      await store.restoreCut(main, cut.cutId);
      const back = await store.readMessagesAt(main, [1, 4]);
      expect(back.messages.map((m) => [m.index, m.content])).toEqual([[1, "line 2"], [4, "line 5"]]);
    });

    test("hidden messages keep their ordinal and their text", async () => {
      const { store, main, ids } = await seeded(4);
      await store.setHidden(ids[1]!, true);
      const page = await store.readMessagesAt(main, [1, 2]);
      expect(page.messages.map((m) => [m.index, m.role, m.content])).toEqual([[1, "assistant", "line 2"], [2, "user", "line 3"]]);
    });

    test("answers with the current swipe, and follows a swipe change", async () => {
      const { store, main, ids } = await seeded(3);
      await store.addSwipe(ids[1]!, { content: "second take" });
      expect((await store.readMessagesAt(main, [1])).messages[0]!.content).toBe("second take");
      await store.selectSwipe(ids[1]!, 0);
      expect((await store.readMessagesAt(main, [1])).messages[0]!.content).toBe("line 2");
    });

    test("several takes stay apart: a fork reads its own messages and a take's edit never leaks across", async () => {
      const { store, main, ids } = await seeded(6);
      const take = (await store.fork(main, ids[3]!))!;
      await store.appendMessage(take.id, { role: "user", content: "only on the take" });
      await store.appendMessage(main, { role: "user", content: "only on main" });
      const onTake = await store.readMessagesAt(take.id, [0, 3, 4, 5]);
      expect(onTake.messages.map((m) => [m.index, m.content])).toEqual([[0, "line 1"], [3, "line 4"], [4, "only on the take"]]);
      const onMain = await store.readMessagesAt(main, [3, 5, 6]);
      expect(onMain.messages.map((m) => [m.index, m.content])).toEqual([[3, "line 4"], [5, "line 6"], [6, "only on main"]]);
    });

    test("refuses more than sixty ordinals or a negative one, and collapses repeats", async () => {
      const { store, main } = await seeded(2);
      await expect(store.readMessagesAt(main, Array.from({ length: 61 }, (_, i) => i))).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.readMessagesAt(main, [-1])).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.readMessagesAt(main, [1, 1, 1])).messages).toHaveLength(1);
    });
  });
}
