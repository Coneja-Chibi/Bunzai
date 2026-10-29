/**
 * The ChatStore contract suite's writer half (docs/reference/scene-state.md, "Who may write"): every store door is one writer (a turn's
 * checkpoint the reply, recordDeltas a background writer, recordMessageDeltas the person, setBranchBase an import), and a slot that does not
 * name that writer refuses the whole write, writing nothing. chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { Delta } from "../../core/scene-state/types";
import type { ChatStore } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

export function chatStoreWritersContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const rejected = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);
  const row = (slot: string, path: string, value: Delta["value"]): Delta => ({ slot, path: [path], value, at: 1 });
  const summaryRow = row("summary", "v1", { version: "v1", text: "Recap.", through: 1, at: 1 });
  const globalOp = row("global", "op1", { id: "op1", name: "gold", op: "set", v: 1 });

  describe("who may write a slot", () => {
    test("a reply's checkpoint cannot write the summary, which only a background writer and the person write", async () => {
      const { store, main } = await seeded(1);
      const open = await store.beginTurn(main, { kind: "reply" });
      const refused = await rejected(store.saveCheckpoint(open!.id, { content: "x", deltas: [summaryRow] }));
      expect(refused).toBeInstanceOf(StudioValidationError);
      expect((refused as Error).message).toContain("does not take writes from a reply");
    });

    test("a background writer, a person's edit and an import cannot write the library's globals, which only a reply writes; nothing is written", async () => {
      const { store, main } = await seeded(2);
      const page = await store.readMessages(main, { limit: 10 });
      const reply = page.messages[1]!;
      expect(await rejected(store.recordDeltas(main, reply.swipes[0]!.id, [globalOp]))).toBeInstanceOf(StudioValidationError);
      expect(await rejected(store.recordMessageDeltas(main, reply.id, [globalOp]))).toBeInstanceOf(StudioValidationError);
      expect(await rejected(store.setBranchBase(main, [globalOp]))).toBeInstanceOf(StudioValidationError);
      expect(await store.globalOps()).toEqual([]);
    });

    test("an import cannot write a tracker, and a whole write with one refused delta writes none of it", async () => {
      const { store, main } = await seeded(1);
      const vars: Delta = { slot: "vars", path: ["mood"], value: "calm", at: 1 };
      const refused = await rejected(store.setBranchBase(main, [vars, row("tracker-record:t1", "hp", 3)]));
      expect((refused as Error).message).toContain("does not take writes from an import");
      expect(await store.sceneState(main)).toEqual({});
    });

    test("each door still takes what its slots allow", async () => {
      const { store, main } = await seeded(2);
      const page = await store.readMessages(main, { limit: 10 });
      expect(await store.setBranchBase(main, [{ slot: "vars", path: ["mood"], value: "calm", at: 1 }])).toBe(true);
      expect(await store.recordMessageDeltas(main, page.messages[1]!.id, [row("tracker-record:t1", "hp", 3)])).toBe(true);
      expect(await store.recordDeltas(main, page.messages[1]!.swipes[0]!.id, [summaryRow])).toBe(true);
    });
  });
}
