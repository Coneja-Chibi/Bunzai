/**
 * The ChatStore contract suite's hide switch: a message shown to the
 * reader and left out of the prompt. Every implementation runs it through chatStoreContract.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError, StudioValidationError } from "../../studio/errors";

import type { ChatStore } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

export function chatStoreHiddenContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);

  describe("hiding a message from the prompt (rule 30)", () => {
    test("hiding and showing round-trips, the message keeps its place, and each change moves the branch version", async () => {
      const { store, main, ids } = await seeded(3);
      const before = (await store.readMessages(main, { limit: 10 })).branchVersion!;
      const hidden = await store.setHidden(ids[1]!, true);
      expect(hidden).toMatchObject({ id: ids[1], seq: 2, hidden: true });
      const page = await store.readMessages(main, { limit: 10 });
      expect(page.messages.map((m) => [m.seq, m.hidden])).toEqual([[1, undefined], [2, true], [3, undefined]]);
      expect(page.branchVersion).toBe(before + 1);
      expect(await store.countMessages(main)).toBe(3);
      const shown = await store.setHidden(ids[1]!, false);
      expect(shown!.hidden).toBeUndefined();
      expect((await store.readMessages(main, { limit: 10 })).branchVersion).toBe(before + 2);
    });

    test("setting what it already is changes nothing, version included", async () => {
      const { store, main, ids } = await seeded(2);
      await store.setHidden(ids[0]!, true);
      const v = (await store.readMessages(main, { limit: 10 })).branchVersion;
      await store.setHidden(ids[0]!, true);
      await store.setHidden(ids[1]!, false);
      expect((await store.readMessages(main, { limit: 10 })).branchVersion).toBe(v);
    });

    test("it shows on the transcript tail page a scene opens on", async () => {
      const { store, main, ids } = await seeded(3);
      await store.setHidden(ids[2]!, true);
      const tail = await store.readMessagesBefore(main, { limit: 10 });
      expect(tail.messages.map((m) => m.hidden)).toEqual([undefined, undefined, true]);
    });

    test("a fork copies the flag, and the two takes share nothing afterwards", async () => {
      const { store, main, ids } = await seeded(3);
      await store.setHidden(ids[0]!, true);
      const take = (await store.fork(main, ids[1]!))!;
      expect((await store.readMessages(take.id, { limit: 10 })).messages.map((m) => m.hidden)).toEqual([true, undefined]);
      const copy = (await store.readMessages(take.id, { limit: 10 })).messages[0]!;
      await store.setHidden(copy.id, false);
      expect((await store.readMessages(main, { limit: 10 })).messages[0]!.hidden).toBe(true);
    });

    test("an absent or cut message answers null, a stale guard is a conflict, a non-boolean is refused, and nothing changes", async () => {
      const { store, main, ids } = await seeded(2);
      expect(await store.setHidden("nope", true)).toBeNull();
      const version = (await store.readMessages(main, { limit: 10 })).branchVersion!;
      const stale = await store.setHidden(ids[0]!, true, { expectedVersion: version + 5 }).then(() => null, (e: unknown) => e);
      expect(stale).toBeInstanceOf(StudioConflictError);
      const bad = await store.setHidden(ids[0]!, "yes" as unknown as boolean).then(() => null, (e: unknown) => e);
      expect(bad).toBeInstanceOf(StudioValidationError); // the route layer answers a validation error with 400
      await store.cutMessages(main, ids[1]!, "one");
      expect(await store.setHidden(ids[1]!, true)).toBeNull();
      expect((await store.readMessages(main, { limit: 10 })).messages.map((m) => m.hidden)).toEqual([undefined, undefined]);
    });

    test("a scene born with a hidden message keeps it hidden; one with a non-boolean flag is refused whole", async () => {
      const r = chatRig(make).rig();
      const base = { createdAt: 5, updatedAt: 6 };
      const msg = (hidden?: boolean) => ({ role: "assistant" as const, createdAt: 5, current: 0, swipes: [{ content: "x", createdAt: 5 }], ...(hidden === undefined ? {} : { hidden }) });
      const chat = await r.store.createChat({ title: "T", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { id: "vera" } }, history: { ...base, messages: [msg(true), msg(false), msg()] } });
      expect((await r.store.readMessages(chat.activeBranchId, { limit: 10 })).messages.map((m) => m.hidden)).toEqual([true, undefined, undefined]);
      const refused = await r.store.createChat({ title: "T", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { id: "vera" } }, history: { ...base, messages: [msg("yes" as unknown as boolean)] } }).then(() => null, (e: unknown) => e);
      expect(refused).toBeInstanceOf(StudioValidationError);
    });
  });
}
