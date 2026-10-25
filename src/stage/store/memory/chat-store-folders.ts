/**
 * The memory ChatStore's Fan Favorites and story folders. Split from chat-store.ts for the file-size cap; the folders
 * Map itself is created there and shared with restoreChat, which clears a dangling folderId (rule 24).
 * Nothing here awaits, so each method is atomic like the rest of the memory store.
 */
import type { Chat, ChatStore, SceneFolder } from "../../contracts/chat-store";
import { checkFolderId, checkFolderName, checkOn, fail } from "../chat-rules";
import type { ChatRecord } from "./chat-records";

export interface FolderDeps {
  clock: () => number;
  newId: () => string;
  chats: Map<string, ChatRecord>;
  folders: Map<string, SceneFolder>;
}

type FolderMethods = Pick<ChatStore, "setFavorite" | "listFolders" | "createFolder" | "renameFolder" | "deleteFolder" | "setFolder">;

export function folderMethods(d: FolderDeps): FolderMethods {
  const liveChat = (id: string): ChatRecord | null => {
    const r = d.chats.get(id);
    return r && r.deletedAt === null ? r : null;
  };

  return {
    async setFavorite(chatId, onRaw) {
      const on = checkOn(onRaw);
      const record = liveChat(chatId);
      if (!record) return null;
      const { favoredAt: _old, ...rest } = record.chat;
      record.chat = on ? { ...rest, favoredAt: d.clock() } : (rest as Chat);
      return structuredClone(record.chat);
    },

    async listFolders() {
      return [...d.folders.values()]
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((f) => ({ ...f, count: [...d.chats.values()].filter((r) => r.deletedAt === null && r.chat.folderId === f.id).length }));
    },

    async createFolder(nameRaw) {
      const name = checkFolderName(nameRaw);
      const folder: SceneFolder = { id: d.newId(), name, createdAt: d.clock() };
      d.folders.set(folder.id, folder);
      return structuredClone(folder);
    },

    async renameFolder(id, nameRaw) {
      const name = checkFolderName(nameRaw);
      if (!d.folders.has(id)) return null;
      const renamed = { ...d.folders.get(id)!, name };
      d.folders.set(id, renamed);
      return structuredClone(renamed);
    },

    async deleteFolder(id) {
      if (!d.folders.delete(id)) return false;
      // Only live scenes: a deleted one keeps its dangling folderId until it is restored (rule 24).
      for (const record of d.chats.values()) {
        if (record.deletedAt === null && record.chat.folderId === id) {
          const { folderId: _old, ...rest } = record.chat;
          record.chat = rest as Chat;
        }
      }
      return true;
    },

    async setFolder(chatId, folderIdRaw) {
      const folderId = checkFolderId(folderIdRaw);
      const record = liveChat(chatId);
      if (!record) return null;
      if (folderId !== null && !d.folders.has(folderId)) fail(`no such folder: ${folderId}`);
      const { folderId: _old, ...rest } = record.chat;
      record.chat = folderId === null ? (rest as Chat) : { ...rest, folderId };
      return structuredClone(record.chat);
    },
  };
}
