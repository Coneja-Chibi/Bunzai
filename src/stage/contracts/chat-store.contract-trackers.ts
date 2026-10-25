/**
 * The ChatStore contract suite's trackers half: what a scene's tracker Props remember, one entry per
 * module. chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { DEFAULT_RESOURCES } from "../../core/trackers/resources";
import { StudioConflictError } from "../../studio/atomic-file";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

export function chatStoreTrackersContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;
  const hurt = { ...DEFAULT_RESOURCES, hp: 40 };

  describe("the scene's trackers (rule 43)", () => {
    test("a new chat has none; a change keeps a module's state, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.trackers).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      expect((await store.setTracker(chat.id, "resources", { data: hurt }))!.trackers).toEqual({ resources: { data: hurt } });
      expect((await store.getChat(chat.id))!.trackers).toEqual({ resources: { data: hurt } });
      expect((await store.listChats()).chats.map((c) => c.trackers)).toEqual([{ resources: { data: hurt } }]);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
    });

    test("a tracker's own automatic-update choice (on or off, and an every override of 1 to 99) is kept beside its state; null returns it to the scene's default", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setTracker(chat.id, "resources", { auto: { every: 3 } }))!.trackers).toEqual({ resources: { auto: { every: 3 } } });
      expect((await store.setTracker(chat.id, "resources", { data: hurt }))!.trackers).toEqual({ resources: { auto: { every: 3 }, data: hurt } });
      expect((await store.setTracker(chat.id, "resources", { auto: { on: false, every: 2 } }))!.trackers).toEqual({ resources: { auto: { on: false, every: 2 }, data: hurt } });
      expect((await store.setTracker(chat.id, "resources", { auto: {} }))!.trackers).toEqual({ resources: { data: hurt } });
      await store.setTracker(chat.id, "resources", { auto: { on: false } });
      expect((await store.setTracker(chat.id, "resources", { auto: null }))!.trackers).toEqual({ resources: { data: hurt } });
      for (const bad of [{ auto: { every: 0 } }, { auto: { every: 100 } }, { auto: { every: 1.5 } }, { auto: { on: "no" } }, { auto: { extra: 1 } }, { auto: 3 }, { dmEvery: 2 }]) await expect(store.setTracker(chat.id, "resources", bad as never)).rejects.toBeInstanceOf(StudioValidationError);
    });

    test("the Story Director's update is kept beside the state it changed and cleared by null; a malformed one is refused whole", async () => {
      const { store, chat } = await seeded(1);
      const update = { messageId: "m1", swipeId: "s1", turn: 2, at: 9, before: null, after: hurt };
      expect((await store.setTracker(chat.id, "resources", { data: hurt, update }))!.trackers).toEqual({ resources: { data: hurt, update } });
      expect((await store.setTracker(chat.id, "resources", { context: "never" }))!.trackers).toEqual({ resources: { data: hurt, update, context: "never" } });
      expect((await store.setTracker(chat.id, "resources", { update: null }))!.trackers).toEqual({ resources: { data: hurt, context: "never" } });
      for (const bad of [{ ...update, messageId: "" }, { ...update, turn: -1 }, { ...update, extra: 1 }, { ...update, after: undefined }, { ...update, after: { x: "y".repeat(50_000) } }]) {
        await expect(store.setTracker(chat.id, "resources", { update: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
    });

    test("the updates the person undid are kept as a bounded list beside the state, replaced whole by a write and cleared by null; a malformed list is refused whole", async () => {
      const { store, chat } = await seeded(1);
      const undone = [{ messageId: "m1", swipeId: "s1", at: 4 }];
      expect((await store.setTracker(chat.id, "resources", { data: hurt, undone }))!.trackers).toEqual({ resources: { data: hurt, undone } });
      expect((await store.setTracker(chat.id, "resources", { context: "never" }))!.trackers).toEqual({ resources: { data: hurt, undone, context: "never" } });
      expect((await store.setTracker(chat.id, "resources", { undone: null }))!.trackers).toEqual({ resources: { data: hurt, context: "never" } });
      const many = Array.from({ length: 51 }, (_, i) => ({ messageId: `m${i}`, swipeId: "s", at: i }));
      for (const bad of [many, [{ messageId: "", swipeId: "s", at: 1 }], [{ messageId: "m", swipeId: "s", at: -1 }], [{ messageId: "m", swipeId: "s", at: 1, extra: 1 }], "no"]) {
        await expect(store.setTracker(chat.id, "resources", { undone: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
    });

    test("the versions the system parked are kept beside the state; a write of the state that names neither an update nor a parked list is a hand edit and clears them", async () => {
      const { store, chat } = await seeded(1);
      const parked = [{ messageId: "m1", swipeId: "s1", at: 4 }];
      const update = { messageId: "m1", swipeId: "s1", turn: 2, at: 9, before: null, after: hurt };
      expect((await store.setTracker(chat.id, "resources", { data: hurt, update, parked }))!.trackers).toEqual({ resources: { data: hurt, update, parked } });
      expect((await store.setTracker(chat.id, "resources", { context: "never" }))!.trackers!.resources!.parked).toEqual(parked);
      expect((await store.setTracker(chat.id, "resources", { data: { ...hurt, hp: 10 }, update: null, parked }))!.trackers!.resources!.parked).toEqual(parked);
      expect((await store.setTracker(chat.id, "resources", { data: { ...hurt, hp: 20 } }))!.trackers!.resources!.parked).toBeUndefined();
      await store.setTracker(chat.id, "resources", { parked });
      expect((await store.setTracker(chat.id, "resources", { parked: [] }))!.trackers!.resources!.parked).toBeUndefined();
      for (const bad of [Array.from({ length: 51 }, (_, i) => ({ messageId: `m${i}`, swipeId: "s", at: i })), [{ messageId: "", swipeId: "s", at: 1 }], "no"]) {
        await expect(store.setTracker(chat.id, "resources", { parked: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
    });

    test("a write that names the state it was planned against is refused, changing nothing, when the state is no longer that", async () => {
      const { store, chat } = await seeded(1);
      const healed = { ...DEFAULT_RESOURCES, hp: 90 };
      expect((await store.setTracker(chat.id, "resources", { data: hurt, expectedData: null }))!.trackers).toEqual({ resources: { data: hurt } });
      expect((await store.setTracker(chat.id, "resources", { data: healed, expectedData: hurt }))!.trackers).toEqual({ resources: { data: healed } });
      const stale = await store.setTracker(chat.id, "resources", { data: hurt, expectedData: hurt }).then(() => null, (e: unknown) => e);
      expect(stale).toBeInstanceOf(StudioConflictError);
      expect((await store.getChat(chat.id))!.trackers).toEqual({ resources: { data: healed } });
    });

    test("a key given replaces, a key left out stays, null clears; a module left with nothing leaves no cell", async () => {
      const { store, chat } = await seeded(1);
      await store.setTracker(chat.id, "resources", { data: hurt, context: "every2" });
      expect((await store.setTracker(chat.id, "resources", { context: "never" }))!.trackers).toEqual({ resources: { data: hurt, context: "never" } });
      expect((await store.setTracker(chat.id, "resources", { context: null }))!.trackers).toEqual({ resources: { data: hurt } });
      expect((await store.setTracker(chat.id, "resources", {}))!.trackers).toEqual({ resources: { data: hurt } });
      expect("trackers" in (await store.setTracker(chat.id, "resources", { data: null }))!).toBe(false);
      expect("trackers" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("a bad change is refused whole and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setTracker(chat.id, "resources", { data: hurt });
      const bad: unknown[] = [{ data: { hp: 1 } }, { data: { ...DEFAULT_RESOURCES, hp: 101 } }, { data: { ...DEFAULT_RESOURCES, extra: 1 } }, { data: "x" }, { context: "sometimes" }, { context: 3 }, { nope: 1 }, [], "x", null];
      for (const patch of bad) await expect(store.setTracker(chat.id, "resources", patch as never)).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.setTracker(chat.id, "wizardry" as never, { context: "never" })).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.trackers).toEqual({ resources: { data: hurt } });
    });

    test("a Storyboard keeps its AI Context profile and its include choice, and refuses anything else as data", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setTracker(chat.id, "map", { context: "always", data: { mode: "radius", radius: 12 } }))!.trackers).toEqual({ map: { context: "always", data: { mode: "radius", radius: 12 } } });
      expect((await store.setTracker(chat.id, "map", { context: "never" }))!.trackers).toEqual({ map: { context: "never", data: { mode: "radius", radius: 12 } } });
      const bad: unknown[] = [{ data: { mode: "wide" } }, { data: { radius: 0 } }, { data: { radius: 31 } }, { data: { radius: 2.5 } }, { data: { mode: "full", extra: 1 } }, { data: { hp: 1 } }];
      for (const patch of bad) await expect(store.setTracker(chat.id, "quests", patch as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.trackers).toEqual({ map: { context: "never", data: { mode: "radius", radius: 12 } } });
    });

    test("an item tracker keeps its items whole, and refuses a state that is not one of its own", async () => {
      const { store, chat } = await seeded(1);
      const item = { id: "a", name: "Rusty Key", description: "x", category: "key", rarity: "common", quantity: 1, obtainedAt: 1 };
      const state = { items: [item, { ...item, id: "b", removedAt: 9 }], equipment: {}, currency: 4 };
      expect((await store.setTracker(chat.id, "inventory", { data: state }))!.trackers).toEqual({ inventory: { data: state } });
      const bad: unknown[] = [{ data: { ...state, extra: 1 } }, { data: { ...state, items: [item, item] } }, { data: { ...state, equipment: { head: "nope" } } }, { data: { ...state, items: [{ ...item, quantity: 0 }] } }, { data: { ...state, currency: -1 } }, { data: { hp: 1 } }];
      for (const patch of bad) await expect(store.setTracker(chat.id, "inventory", patch as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.trackers).toEqual({ inventory: { data: state } });
    });

    test("it belongs to the chat: a restore keeps it, and a missing or deleted chat answers null", async () => {
      const { store, chat } = await seeded(1);
      await store.setTracker(chat.id, "resources", { data: hurt });
      await store.deleteChat(chat.id);
      expect(await store.setTracker(chat.id, "resources", { context: "never" })).toBeNull();
      expect(await store.setTracker("nope", "resources", { context: "never" })).toBeNull();
      await store.restoreChat(chat.id);
      expect((await store.getChat(chat.id))!.trackers).toEqual({ resources: { data: hurt } });
    });
  });
}
