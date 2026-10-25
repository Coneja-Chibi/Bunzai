/**
 * The ChatStore contract suite's persona half: swapping the
 * persona a scene plays without touching the card's way back, the stamp each user message keeps of the
 * persona that wrote it, and the refusal to recast a scene while a reply is being written. Every
 * implementation runs it through chatStoreContract.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError } from "../../studio/atomic-file";
import { StudioValidationError } from "../../studio/errors";
import type { Cast, CastSnapshot, ChatStore } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

const NUIT = { id: "nuit", version: 2, name: "Nuit" };
const CORVIN = { id: "corvin", version: 1, name: "Corvin" };
const persona = (id: string, name: string) => ({ kind: "persona", id, body: { name } });
const CAST: Cast = { character: { id: "vera", version: 3 }, persona: NUIT };
const SNAP: CastSnapshot = { character: { kind: "character", id: "vera", body: { identity: { name: "Vera" } } }, persona: persona("nuit", "Nuit") };
const NEWER_CHARACTER = { kind: "character", id: "vera", body: { identity: { name: "Vera II" } } };

export function chatStorePersonaContract(make: (clock: () => number) => ChatStore): void {
  const { rig } = chatRig(make);
  const start = async (cast: Cast = CAST, snapshot: CastSnapshot = SNAP) => {
    const r = rig();
    const chat = await r.store.createChat({ title: "T", cast, snapshot });
    return { ...r, chat, main: chat.activeBranchId };
  };
  const swapToCorvin = { persona: CORVIN, snapshot: persona("corvin", "Corvin") };
  const users = async (store: ChatStore, branchId: string) =>
    (await store.readMessages(branchId, { limit: 100 })).messages.filter((m) => m.role === "user").map((m) => m.persona);

  describe("swapping the persona (rule 13)", () => {
    test("setPersona changes the persona and its snapshot and bumps the snapshot version; the card is untouched", async () => {
      const { store, chat, setNow } = await start();
      setNow(2_000);
      const moved = await store.setPersona(chat.id, swapToCorvin);
      expect(moved!.cast).toEqual({ character: CAST.character, persona: CORVIN });
      expect(moved!.snapshotVersion).toBe(chat.snapshotVersion + 1);
      expect(moved!.updatedAt).toBe(2_000);
      expect(moved!.previousCast).toBeUndefined();
      expect(await store.castSnapshot(chat.id)).toEqual({ ...SNAP, persona: swapToCorvin.snapshot });
    });

    test("it never erases the card's way back, and reverting the card leaves the swapped persona alone", async () => {
      const { store, chat } = await start();
      const newer = { ...CAST, character: { ...CAST.character, version: 5 } };
      await store.setCast(chat.id, { cast: newer, snapshot: { ...SNAP, character: NEWER_CHARACTER } });
      const swapped = await store.setPersona(chat.id, swapToCorvin);
      expect(swapped!.previousCast).toEqual(CAST);
      const back = await store.revertCast(chat.id, { fromVersion: 5 });
      expect(back!.cast).toEqual({ character: CAST.character, persona: CORVIN });
      expect(await store.castSnapshot(chat.id)).toEqual({ character: SNAP.character, persona: swapToCorvin.snapshot });
      // The step back is itself revertible, and it keeps who you play too.
      const forward = await store.revertCast(chat.id, { fromVersion: 3 });
      expect(forward!.cast.character.version).toBe(5);
      expect(forward!.cast.persona).toEqual(CORVIN);
      expect(await store.castSnapshot(chat.id)).toEqual({ character: NEWER_CHARACTER, persona: swapToCorvin.snapshot });
    });

    test("a card update after a swap keeps the swapped persona", async () => {
      const { store, chat } = await start();
      await store.setPersona(chat.id, swapToCorvin);
      const current = (await store.getChat(chat.id))!;
      await store.setCast(chat.id, { cast: { ...current.cast, character: { ...CAST.character, version: 5 } }, snapshot: { character: NEWER_CHARACTER, persona: swapToCorvin.snapshot } });
      expect((await store.getChat(chat.id))!.cast.persona).toEqual(CORVIN);
      expect((await store.revertCast(chat.id))!.cast.persona).toEqual(CORVIN);
    });

    test("playing no persona clears it from the cast and the snapshot", async () => {
      const { store, chat } = await start();
      const moved = await store.setPersona(chat.id, { persona: null, snapshot: null });
      expect(moved!.cast).toEqual({ character: CAST.character });
      expect(await store.castSnapshot(chat.id)).toEqual({ character: SNAP.character });
      const again = await store.setPersona(chat.id, swapToCorvin);
      expect(again!.cast.persona).toEqual(CORVIN);
    });

    test("setCast refuses a different persona: who is played changes only through setPersona", async () => {
      const { store, chat } = await start();
      const other = { ...CAST, persona: CORVIN };
      await expect(store.setCast(chat.id, { cast: other, snapshot: { ...SNAP, persona: persona("corvin", "Corvin") } })).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.setCast(chat.id, { cast: { character: CAST.character }, snapshot: { character: SNAP.character } })).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.cast.persona).toEqual(NUIT);
      expect((await store.getChat(chat.id))!.snapshotVersion).toBe(chat.snapshotVersion);
    });

    test("the same persona changes nothing", async () => {
      const { store, chat, setNow } = await start();
      setNow(9_000);
      const same = await store.setPersona(chat.id, { persona: NUIT, snapshot: SNAP.persona! });
      expect(same!.snapshotVersion).toBe(chat.snapshotVersion);
      expect(same!.updatedAt).toBe(chat.updatedAt);
    });

    test("an absent or deleted scene is null; a persona without its snapshot is refused", async () => {
      const { store, chat } = await start();
      expect(await store.setPersona("nope", swapToCorvin)).toBeNull();
      await expect(store.setPersona(chat.id, { persona: CORVIN, snapshot: null })).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.setPersona(chat.id, { persona: null, snapshot: persona("x", "X") })).rejects.toBeInstanceOf(StudioValidationError);
      await store.deleteChat(chat.id);
      expect(await store.setPersona(chat.id, swapToCorvin)).toBeNull();
    });

    test("a swap that expected another snapshot version is a conflict and changes nothing", async () => {
      const { store, chat } = await start();
      await store.setPersona(chat.id, swapToCorvin);
      await expect(store.setPersona(chat.id, { persona: NUIT, snapshot: SNAP.persona!, expectedSnapshotVersion: chat.snapshotVersion })).rejects.toBeInstanceOf(StudioConflictError);
      expect((await store.getChat(chat.id))!.cast.persona).toEqual(CORVIN);
    });
  });

  describe("no recast while a reply is being written (rule 26)", () => {
    test("setPersona, setCast and revertCast are refused while a turn is open on any take, and work once it is dropped", async () => {
      const { store, chat, main } = await start();
      await store.appendMessage(main, { role: "user", content: "hi" });
      const turn = await store.beginTurn(main, { kind: "reply" });
      await expect(store.setPersona(chat.id, swapToCorvin)).rejects.toBeInstanceOf(StudioConflictError);
      const newer = { ...CAST, character: { ...CAST.character, version: 5 } };
      await expect(store.setCast(chat.id, { cast: newer, snapshot: { ...SNAP, character: NEWER_CHARACTER } })).rejects.toBeInstanceOf(StudioConflictError);
      expect((await store.getChat(chat.id))!.snapshotVersion).toBe(chat.snapshotVersion);
      await store.dropTurn(turn!.id);
      await store.setCast(chat.id, { cast: newer, snapshot: { ...SNAP, character: NEWER_CHARACTER } });
      const again = await store.beginTurn(main, { kind: "reply" });
      await expect(store.revertCast(chat.id)).rejects.toBeInstanceOf(StudioConflictError);
      expect((await store.getChat(chat.id))!.cast.character.version).toBe(5);
      await store.dropTurn(again!.id);
      expect((await store.revertCast(chat.id))!.cast.character.version).toBe(3);
      expect((await store.setPersona(chat.id, swapToCorvin))!.cast.persona).toEqual(CORVIN);
    });
  });

  describe("each user message keeps the persona that wrote it (rule 26)", () => {
    test("a user message is stamped with the scene's persona when it is written; others are not", async () => {
      const { store, main, chat } = await start();
      await store.appendMessages(main, [{ role: "assistant", content: "greeting" }, { role: "user", content: "one" }]);
      await store.setPersona(chat.id, swapToCorvin);
      await store.appendMessage(main, { role: "user", content: "two" });
      await store.setPersona(chat.id, { persona: null, snapshot: null });
      await store.appendMessage(main, { role: "user", content: "three" });
      const { messages } = await store.readMessages(main, { limit: 10 });
      expect(messages[0]!.persona).toBeUndefined();
      expect(await users(store, main)).toEqual([{ id: "nuit", name: "Nuit" }, { id: "corvin", name: "Corvin" }, null]);
    });

    test("a persona that has no name yet leaves the message unstamped, never half stamped", async () => {
      const { store, main } = await start({ ...CAST, persona: { id: "nuit", version: 2 } });
      await store.appendMessage(main, { role: "user", content: "one" });
      expect(await users(store, main)).toEqual([undefined]);
    });

    test("a take forked from the scene and a bounded transcript page both carry the stamp", async () => {
      const { store, main, chat } = await start();
      const first = await store.appendMessage(main, { role: "user", content: "one" });
      await store.setPersona(chat.id, swapToCorvin);
      await store.appendMessage(main, { role: "user", content: "two" });
      const take = await store.fork(main, (await store.appendMessage(main, { role: "assistant", content: "reply" }))!.id);
      expect(await users(store, take!.id)).toEqual([{ id: "nuit", name: "Nuit" }, { id: "corvin", name: "Corvin" }]);
      const page = await store.readMessagesBefore(main, { limit: 10 });
      expect(page.messages.filter((m) => m.role === "user").map((m) => m.persona)).toEqual([{ id: "nuit", name: "Nuit" }, { id: "corvin", name: "Corvin" }]);
      expect(first!.persona).toEqual({ id: "nuit", name: "Nuit" });
    });
  });
}
