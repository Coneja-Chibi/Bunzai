/**
 * The ChatStore contract suite's Fan Favorites and story folders half. Modeled on chat-store.contract-props.ts for the
 * single-field parts, plus a folder's own create/rename/delete lifecycle and the restore-after-delete
 * case. chatStoreContract runs it, so every implementation gets it.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { CAST, SNAP, chatRig } from "./chat-store.contract-rig";

export function chatStoreFoldersContract(make: (clock: () => number) => ChatStore): void {
  const { rig, seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;

  describe("Fan Favorites (rule 23)", () => {
    test("setFavorite stars and unstars, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.favoredAt).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      expect((await store.setFavorite(chat.id, true))!.favoredAt).toBe(8_000);
      expect((await store.getChat(chat.id))!.favoredAt).toBe(8_000);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
      expect(await store.setFavorite(chat.id, false)).toEqual(chat);
      expect("favoredAt" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("favoredAt supports newest-starred-first ordering", async () => {
      const { store, setNow } = rig();
      const a = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
      const b = await store.createChat({ title: "B", cast: CAST, snapshot: SNAP });
      setNow(2_000);
      await store.setFavorite(a.id, true);
      setNow(5_000);
      await store.setFavorite(b.id, true);
      const favorites = (await store.listChats()).chats
        .filter((c) => c.favoredAt !== undefined)
        .sort((x, y) => y.favoredAt! - x.favoredAt!);
      expect(favorites.map((c) => c.id)).toEqual([b.id, a.id]);
    });

    test("an absent or deleted chat takes none; a restored one keeps what it had", async () => {
      const { store, chat } = await seeded(1);
      await store.setFavorite(chat.id, true);
      expect(await store.setFavorite("nope", true)).toBeNull();
      await store.deleteChat(chat.id);
      expect(await store.setFavorite(chat.id, false)).toBeNull();
      expect((await store.chatGraveyard()).chats[0]!.favoredAt).toBe(1_000);
      expect((await store.restoreChat(chat.id))!.favoredAt).toBe(1_000);
    });

    test("anything but true or false is refused and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await expect(store.setFavorite(chat.id, "yes" as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.favoredAt).toBeUndefined();
    });
  });

  describe("story folders (rule 24)", () => {
    test("create, list oldest first with counts, rename, and delete", async () => {
      const { store } = rig();
      const a = await store.createFolder("  Heists  ");
      const b = await store.createFolder("Slow burns");
      expect(a.name).toBe("Heists");
      expect(await store.listFolders()).toEqual([{ ...a, count: 0 }, { ...b, count: 0 }]);

      const scene = await store.createChat({ title: "S", cast: CAST, snapshot: SNAP });
      await store.setFolder(scene.id, a.id);
      expect((await store.listFolders()).find((f) => f.id === a.id)!.count).toBe(1);

      const renamed = await store.renameFolder(a.id, "Capers");
      expect(renamed!.name).toBe("Capers");
      expect(await store.renameFolder("nope", "X")).toBeNull();

      expect(await store.deleteFolder(a.id)).toBe(true);
      expect(await store.deleteFolder(a.id)).toBe(false);
      expect(await store.listFolders()).toEqual([{ ...b, count: 0 }]);
    });

    test("name validation: trimmed, empty, and over 80 characters are refused", async () => {
      const { store } = rig();
      await expect(store.createFolder("   ")).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.createFolder("a".repeat(81))).rejects.toBeInstanceOf(StudioValidationError);
      const max = await store.createFolder("a".repeat(80));
      expect(max.name).toHaveLength(80);
      await expect(store.renameFolder(max.id, "")).rejects.toBeInstanceOf(StudioValidationError);
    });

    test("setFolder moves a scene, clears it with null, and an unknown id throws and writes nothing", async () => {
      const { store, chat } = await seeded(1);
      const folder = await store.createFolder("Heists");
      expect((await store.setFolder(chat.id, folder.id))!.folderId).toBe(folder.id);
      expect((await store.getChat(chat.id))!.folderId).toBe(folder.id);
      // The scene is already in a real folder, so a bug that writes before validating would move it
      // away from `folder.id` here, not merely leave a still-empty field looking untouched.
      await expect(store.setFolder(chat.id, "no-such-folder")).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.folderId).toBe(folder.id);
      expect((await store.setFolder(chat.id, null))!.folderId).toBeUndefined();
    });

    test("setFolder bumps no version and moves no updatedAt; an absent chat is null", async () => {
      const { store, chat, main } = await seeded(1);
      const folder = await store.createFolder("Heists");
      const before = await version(store, main);
      await store.setFolder(chat.id, folder.id);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
      expect(await store.setFolder("nope", folder.id)).toBeNull();
    });

    test("deleting a folder keeps its scenes and clears their folderId; counts ignore deleted scenes", async () => {
      const { store } = rig();
      const folder = await store.createFolder("Heists");
      const kept = await store.createChat({ title: "Kept", cast: CAST, snapshot: SNAP });
      const gone = await store.createChat({ title: "Gone", cast: CAST, snapshot: SNAP });
      await store.setFolder(kept.id, folder.id);
      await store.setFolder(gone.id, folder.id);
      await store.deleteChat(gone.id);
      expect((await store.listFolders()).find((f) => f.id === folder.id)!.count).toBe(1);

      expect(await store.deleteFolder(folder.id)).toBe(true);
      expect((await store.getChat(kept.id))!.folderId).toBeUndefined();
      expect(await store.listFolders()).toEqual([]);
    });

    test("a scene cut to the Trash and restored keeps its folder, or has none if the folder is gone", async () => {
      const { store } = rig();
      const folder = await store.createFolder("Heists");
      const chat = await store.createChat({ title: "S", cast: CAST, snapshot: SNAP });
      await store.setFolder(chat.id, folder.id);
      await store.deleteChat(chat.id);
      expect((await store.restoreChat(chat.id))!.folderId).toBe(folder.id);

      await store.deleteChat(chat.id);
      await store.deleteFolder(folder.id);
      expect((await store.restoreChat(chat.id))!.folderId).toBeUndefined();
    });
  });
}
