/**
 * The ChatStore contract suite's participants half: a scene's sparse participant roster. The
 * card and the player are never stored until the person changes them; NPCs are, and are retired, never deleted. chatStoreContract
 * runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

const add = (store: ChatStore, chatId: string, names: string[], run = "r1") => store.updateParticipants(chatId, { op: "add", run, people: names.map((name) => ({ name })) });

export function chatStoreParticipantsContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;

  describe("the scene's participants (rule 41)", () => {
    test("a new chat stores nothing: the card and the player are read from the cast, never written by a read", async () => {
      const { chat } = await seeded(1);
      expect(chat.participants).toBeUndefined();
    });

    test("adding stores NPCs with the run that added them, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      const before = await version(store, main);
      const updated = chat.updatedAt;
      setNow(9_000);
      const got = (await add(store, chat.id, ["Atlas Guard", "  Mira   Vance "]))!;
      expect(got.participants!.people).toEqual([
        { id: expect.any(String), kind: "npc", name: "Atlas Guard", run: "r1", at: 9_000 },
        { id: expect.any(String), kind: "npc", name: "Mira Vance", run: "r1", at: 9_000 },
      ]);
      expect((await store.getChat(chat.id))!.participants).toEqual(got.participants);
      expect((await store.listChats()).chats[0]!.participants).toEqual(got.participants);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(updated);
    });

    test("an edit sets and clears fields; colours are lower-cased hex, at most three, and a bad one changes nothing", async () => {
      const { store, chat } = await seeded(1);
      const [npc] = (await add(store, chat.id, ["Atlas Guard"]))!.participants!.people;
      const id = npc!.id;
      let got = (await store.updateParticipants(chat.id, { op: "edit", id, edit: { colors: ["#ABCDEF", "#123"], presence: "present", description: "Stern." } }))!;
      expect(got.participants!.people[0]).toMatchObject({ colors: ["#abcdef", "#123"], presence: "present", description: "Stern." });
      got = (await store.updateParticipants(chat.id, { op: "edit", id, edit: { colors: null, presence: null, description: null, name: "Atlas Captain" } }))!;
      expect(got.participants!.people[0]).toEqual({ id, kind: "npc", name: "Atlas Captain", run: "r1", at: expect.any(Number) });
      for (const edit of [{ colors: ["red"] }, { colors: ["#111", "#222", "#333", "#444"] }, { presence: "away" }, { name: "  " }, { name: "a\nb" }, { description: "x".repeat(601) }, { colors: "#fff" }, { nope: 1 }]) {
        await expect(store.updateParticipants(chat.id, { op: "edit", id, edit } as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect((await store.getChat(chat.id))!.participants!.people[0]!.name).toBe("Atlas Captain");
    });

    test("the card and the player store an override only once changed, and drop it when nothing is left to override", async () => {
      const { store, chat } = await seeded(1);
      let got = (await store.updateParticipants(chat.id, { op: "edit", id: "player", edit: { colors: ["#ff00aa"] } }))!;
      expect(got.participants!.people).toEqual([{ id: "player", kind: "player", colors: ["#ff00aa"], at: expect.any(Number) }]);
      got = (await store.updateParticipants(chat.id, { op: "edit", id: "player", edit: { colors: null } }))!;
      expect(got.participants).toBeUndefined();
      got = (await store.updateParticipants(chat.id, { op: "edit", id: "card", edit: { presence: "absent" } }))!;
      expect(got.participants!.people[0]).toMatchObject({ id: "card", kind: "card", presence: "absent" });
    });

    test("RETIRE keeps the participant and Restore brings it back; the card and the player cannot be retired", async () => {
      const { store, chat } = await seeded(1);
      const [npc] = (await add(store, chat.id, ["Atlas Guard"]))!.participants!.people;
      let got = (await store.updateParticipants(chat.id, { op: "edit", id: npc!.id, edit: { retired: true } }))!;
      expect(got.participants!.people[0]).toMatchObject({ id: npc!.id, name: "Atlas Guard", retired: true });
      got = (await store.updateParticipants(chat.id, { op: "edit", id: npc!.id, edit: { retired: false } }))!;
      expect(got.participants!.people[0]!.retired).toBeUndefined();
      for (const id of ["card", "player"]) {
        await expect(store.updateParticipants(chat.id, { op: "edit", id, edit: { retired: true } })).rejects.toBeInstanceOf(StudioValidationError);
      }
      await expect(store.updateParticipants(chat.id, { op: "edit", id: "nobody", edit: { presence: "present" } })).rejects.toBeInstanceOf(StudioValidationError);
    });

    test("a name already on the roster, retired or not, is refused whole, so a run adds all of its people or none", async () => {
      const { store, chat } = await seeded(1);
      const [npc] = (await add(store, chat.id, ["Atlas Guard"]))!.participants!.people;
      await expect(add(store, chat.id, ["Mira", "atlas   GUARD"], "r2")).rejects.toBeInstanceOf(StudioValidationError);
      await expect(add(store, chat.id, ["Twin", "twin"], "r2")).rejects.toBeInstanceOf(StudioValidationError);
      await store.updateParticipants(chat.id, { op: "edit", id: npc!.id, edit: { retired: true } });
      await expect(add(store, chat.id, ["Atlas Guard"], "r2")).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.participants!.people).toHaveLength(1);
    });

    test("Set Main points at the player or a live NPC and Unset Main goes back to the card; a retired NPC cannot be main, and retiring the main clears it", async () => {
      const { store, chat } = await seeded(1);
      const [npc] = (await add(store, chat.id, ["Atlas Guard"]))!.participants!.people;
      expect((await store.updateParticipants(chat.id, { op: "main", id: npc!.id }))!.participants!.main).toBe(npc!.id);
      expect((await store.updateParticipants(chat.id, { op: "main", id: "player" }))!.participants!.main).toBe("player");
      expect((await store.updateParticipants(chat.id, { op: "main", id: npc!.id }))!.participants!.main).toBe(npc!.id);
      expect((await store.updateParticipants(chat.id, { op: "edit", id: npc!.id, edit: { retired: true } }))!.participants!.main).toBeUndefined();
      await expect(store.updateParticipants(chat.id, { op: "main", id: npc!.id })).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.updateParticipants(chat.id, { op: "main", id: "nobody" })).rejects.toBeInstanceOf(StudioValidationError);
      await store.updateParticipants(chat.id, { op: "edit", id: npc!.id, edit: { retired: false } });
      await store.updateParticipants(chat.id, { op: "main", id: npc!.id });
      expect((await store.updateParticipants(chat.id, { op: "main", id: "card" }))!.participants!.main).toBeUndefined();
    });

    test("Undo of a run retires what that run added and nothing else", async () => {
      const { store, chat } = await seeded(1);
      await add(store, chat.id, ["Atlas Guard"], "r1");
      const two = (await add(store, chat.id, ["Mira Vance", "Sol"], "r2"))!.participants!.people;
      await store.updateParticipants(chat.id, { op: "main", id: two[1]!.id });
      const got = (await store.updateParticipants(chat.id, { op: "undo", run: "r2" }))!;
      expect(got.participants!.people.map((p) => [p.name, p.retired === true])).toEqual([["Atlas Guard", false], ["Mira Vance", true], ["Sol", true]]);
      expect(got.participants!.main).toBeUndefined();
      expect((await store.updateParticipants(chat.id, { op: "undo", run: "none" }))!.participants!.people).toHaveLength(3);
    });

    test("a malformed change is refused whole and nothing is stored", async () => {
      const { store, chat } = await seeded(1);
      for (const bad of [null, "add", {}, { op: "wipe" }, { op: "add", run: "r", people: [] }, { op: "add", run: "", people: [{ name: "A" }] }, { op: "add", run: "r", people: [{ name: "A", extra: 1 }] }, { op: "add", run: "r", people: [{ name: "" }] }, { op: "add", run: "r", people: Array.from({ length: 51 }, (_, i) => ({ name: `N${i}` })) }, { op: "edit", id: "", edit: {} }, { op: "undo" }]) {
        await expect(store.updateParticipants(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect((await store.getChat(chat.id))!.participants).toBeUndefined();
    });

    test("an absent scene has none, and a deleted scene hides its roster and gets it back when restored", async () => {
      const { store, chat } = await seeded(1);
      expect(await add(store, "nope", ["A"])).toBeNull();
      await add(store, chat.id, ["Atlas Guard"]);
      await store.deleteChat(chat.id);
      expect(await add(store, chat.id, ["B"])).toBeNull();
      await store.restoreChat(chat.id);
      expect((await store.getChat(chat.id))!.participants!.people).toHaveLength(1);
    });
  });
}
