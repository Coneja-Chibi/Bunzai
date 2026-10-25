/**
 * The SQLite ChatStore's Fan Favorites and story folders. Split from chat-store.ts for the file-size cap; it works on
 * that file's rows and helpers (chat-store-cuts.ts's ChatSqlKit), so each write is still one
 * transaction taking the write lock first. Migration 16 holds favored_at, folder_id, and the
 * scene_folders table; favored_at is a plain time, never sealed, like created_at; folder names are
 * sealed at rest, like a chat's title.
 */
import type { ChatStore, SceneFolder } from "../../contracts/chat-store";
import { checkFolderId, checkFolderName, checkOn, fail } from "../chat-rules";
import type { ChatSqlKit } from "./chat-store-cuts";

interface FolderSql {
  id: string;
  name: string;
  created_at: number;
}

type FolderMethods = Pick<ChatStore, "setFavorite" | "listFolders" | "createFolder" | "renameFolder" | "deleteFolder" | "setFolder">;

export function folderMethods(k: ChatSqlKit): FolderMethods {
  const { statement } = k.database;
  const toFolder = (r: FolderSql): SceneFolder => ({ id: r.id, name: k.cipher.open("scene_folders.name", r.name), createdAt: r.created_at });
  const folderRow = (id: string) => k.one<FolderSql>("SELECT id, name, created_at FROM scene_folders WHERE id = ?", id);

  return {
    async setFavorite(chatId, onRaw) {
      const on = checkOn(onRaw);
      const favoredAt = on ? k.clock() : null;
      const changed = await k.write(() => k.run("UPDATE chats SET favored_at = ? WHERE id = ? AND deleted_at IS NULL", favoredAt, chatId));
      return changed ? k.toChat(k.chatRow(chatId)!) : null;
    },

    async listFolders() {
      const rows = statement("SELECT id, name, created_at FROM scene_folders ORDER BY created_at, rowid").all() as FolderSql[];
      return rows.map((r) => ({
        ...toFolder(r),
        count: k.one<{ n: number }>("SELECT count(*) AS n FROM chats WHERE folder_id = ? AND deleted_at IS NULL", r.id)!.n,
      }));
    },

    async createFolder(nameRaw) {
      const name = checkFolderName(nameRaw);
      const id = k.newId();
      const createdAt = k.clock();
      await k.write(() => k.run("INSERT INTO scene_folders (id, name, created_at) VALUES (?, ?, ?)", id, k.cipher.seal("scene_folders.name", name), createdAt));
      return toFolder(folderRow(id)!);
    },

    async renameFolder(id, nameRaw) {
      const name = checkFolderName(nameRaw);
      const changed = await k.write(() => k.run("UPDATE scene_folders SET name = ? WHERE id = ?", k.cipher.seal("scene_folders.name", name), id));
      return changed ? toFolder(folderRow(id)!) : null;
    },

    async deleteFolder(id) {
      return k.write(() => {
        const deleted = k.run("DELETE FROM scene_folders WHERE id = ?", id) > 0;
        // Only live scenes: a deleted one keeps its dangling folder_id until it is restored (rule 24).
        if (deleted) k.run("UPDATE chats SET folder_id = NULL WHERE folder_id = ? AND deleted_at IS NULL", id);
        return deleted;
      });
    },

    async setFolder(chatId, folderIdRaw) {
      const folderId = checkFolderId(folderIdRaw);
      return k.write(() => {
        if (!k.liveChat(chatId)) return null;
        if (folderId !== null && !folderRow(folderId)) fail(`no such folder: ${folderId}`);
        k.run("UPDATE chats SET folder_id = ? WHERE id = ?", folderId, chatId);
        return k.toChat(k.chatRow(chatId)!);
      });
    },
  };
}
