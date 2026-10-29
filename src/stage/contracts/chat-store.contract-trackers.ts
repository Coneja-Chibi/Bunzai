/**
 * The ChatStore contract suite's trackers half: what a scene's tracker Props remember per module, their SETTINGS (AI Context, the automatic-update choice, the sub-feature switches and, for a
 * Storyboard, its profile). A module's state is not here: it is the scene-state slot `tracker.<module>` (chat-store.contract-tracker-state.ts). chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

export function chatStoreTrackersContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;

  describe("the scene's tracker settings (rule 43)", () => {
    test("a new chat has none; a change keeps a module's settings, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.trackers).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      expect((await store.setTracker(chat.id, "resources", { context: "every2" }))!.trackers).toEqual({ resources: { context: "every2" } });
      expect((await store.getChat(chat.id))!.trackers).toEqual({ resources: { context: "every2" } });
      expect((await store.listChats()).chats.map((c) => c.trackers)).toEqual([{ resources: { context: "every2" } }]);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
    });

    test("a tracker's own automatic-update choice (on or off, and an every override of 1 to 99) is kept beside its other settings; null returns it to the scene's default", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setTracker(chat.id, "resources", { auto: { every: 3 } }))!.trackers).toEqual({ resources: { auto: { every: 3 } } });
      expect((await store.setTracker(chat.id, "resources", { context: "never" }))!.trackers).toEqual({ resources: { auto: { every: 3 }, context: "never" } });
      expect((await store.setTracker(chat.id, "resources", { auto: { on: false, every: 2 } }))!.trackers).toEqual({ resources: { auto: { on: false, every: 2 }, context: "never" } });
      expect((await store.setTracker(chat.id, "resources", { auto: {} }))!.trackers).toEqual({ resources: { context: "never" } });
      await store.setTracker(chat.id, "resources", { auto: { on: false } });
      expect((await store.setTracker(chat.id, "resources", { auto: null }))!.trackers).toEqual({ resources: { context: "never" } });
      for (const bad of [{ auto: { every: 0 } }, { auto: { every: 100 } }, { auto: { every: 1.5 } }, { auto: { on: "no" } }, { auto: { extra: 1 } }, { auto: 3 }, { dmEvery: 2 }]) await expect(store.setTracker(chat.id, "resources", bad as never)).rejects.toBeInstanceOf(StudioValidationError);
    });

    test("the sub-feature switches are a setting of the module that has them: kept beside AI Context, replaced whole, cleared by null or empty, and refused for a switch the module does not have", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setTracker(chat.id, "spellbook", { subs: { wildMagic: true } }))!.trackers).toEqual({ spellbook: { subs: { wildMagic: true } } });
      expect((await store.setTracker(chat.id, "spellbook", { context: "every5" }))!.trackers).toEqual({ spellbook: { subs: { wildMagic: true }, context: "every5" } });
      expect((await store.setTracker(chat.id, "spellbook", { subs: { tacticalMode: true, wildMagic: false } }))!.trackers!.spellbook!.subs).toEqual({ tacticalMode: true, wildMagic: false });
      expect((await store.setTracker(chat.id, "spellbook", { subs: {} }))!.trackers).toEqual({ spellbook: { context: "every5" } });
      await store.setTracker(chat.id, "spellbook", { subs: { wildMagic: true } });
      expect((await store.setTracker(chat.id, "spellbook", { subs: null }))!.trackers).toEqual({ spellbook: { context: "every5" } });
      for (const bad of [{ subs: { secrets: true } }, { subs: { wildMagic: "yes" } }, { subs: 3 }, { subs: [] }]) await expect(store.setTracker(chat.id, "spellbook", bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.setTracker(chat.id, "resources", { subs: { wildMagic: true } })).rejects.toBeInstanceOf(StudioValidationError);
    });

    test("a module's state is not a setting: data is refused for every module but a Storyboard, whatever it holds", async () => {
      const { store, chat } = await seeded(1);
      for (const module of ["resources", "inventory", "spellbook", "codex"] as const) {
        for (const patch of [{ data: null }, { data: { hp: 1 } }, { update: { messageId: "m" } }, { undone: [] }, { parked: [] }, { expectedData: null }]) await expect(store.setTracker(chat.id, module, patch as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect((await store.getChat(chat.id))!.trackers).toBeUndefined();
    });

    test("a key given replaces, a key left out stays, null clears; a module left with nothing leaves no cell", async () => {
      const { store, chat } = await seeded(1);
      await store.setTracker(chat.id, "resources", { context: "every2", auto: { every: 4 } });
      expect((await store.setTracker(chat.id, "resources", { context: "never" }))!.trackers).toEqual({ resources: { context: "never", auto: { every: 4 } } });
      expect((await store.setTracker(chat.id, "resources", { context: null }))!.trackers).toEqual({ resources: { auto: { every: 4 } } });
      expect((await store.setTracker(chat.id, "resources", {}))!.trackers).toEqual({ resources: { auto: { every: 4 } } });
      expect("trackers" in (await store.setTracker(chat.id, "resources", { auto: null }))!).toBe(false);
      expect("trackers" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("a bad change is refused whole and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setTracker(chat.id, "resources", { context: "never" });
      const bad: unknown[] = [{ context: "sometimes" }, { context: 3 }, { nope: 1 }, [], "x", null];
      for (const patch of bad) await expect(store.setTracker(chat.id, "resources", patch as never)).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.setTracker(chat.id, "wizardry" as never, { context: "never" })).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.trackers).toEqual({ resources: { context: "never" } });
    });

    test("a Storyboard keeps its AI Context profile and its include choice, and refuses anything else as data", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setTracker(chat.id, "map", { context: "always", data: { mode: "radius", radius: 12 } }))!.trackers).toEqual({ map: { context: "always", data: { mode: "radius", radius: 12 } } });
      expect((await store.setTracker(chat.id, "map", { context: "never" }))!.trackers).toEqual({ map: { context: "never", data: { mode: "radius", radius: 12 } } });
      const bad: unknown[] = [{ data: { mode: "wide" } }, { data: { radius: 0 } }, { data: { radius: 31 } }, { data: { radius: 2.5 } }, { data: { mode: "full", extra: 1 } }, { data: { hp: 1 } }];
      for (const patch of bad) await expect(store.setTracker(chat.id, "quests", patch as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.trackers).toEqual({ map: { context: "never", data: { mode: "radius", radius: 12 } } });
    });

    test("it belongs to the chat: a restore keeps it, and a missing or deleted chat answers null", async () => {
      const { store, chat } = await seeded(1);
      await store.setTracker(chat.id, "resources", { context: "every2" });
      await store.deleteChat(chat.id);
      expect(await store.setTracker(chat.id, "resources", { context: "never" })).toBeNull();
      expect(await store.setTracker("nope", "resources", { context: "never" })).toBeNull();
      await store.restoreChat(chat.id);
      expect((await store.getChat(chat.id))!.trackers).toEqual({ resources: { context: "every2" } });
    });
  });
}
