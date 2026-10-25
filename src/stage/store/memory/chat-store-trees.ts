/**
 * The memory ChatStore's stored tree layouts. Layouts live in append order and the newest live
 * one of a book is current; every value handed out is a deep copy. A deleted scene's layouts stay hidden and come back with it;
 * `drop` removes them when the scene is purged.
 */
import type { ChatStore } from "../../contracts/chat-store";
import type { StoredTree } from "../../contracts/chat-tree-types";
import { checkText } from "../chat-rules";
import { checkLayout } from "../tree-rules";
import type { ChatRecord } from "./chat-records";

export interface TreeDeps {
  chats: Map<string, ChatRecord>;
  clock: () => number;
  newId: () => string;
}

type TreeMethods = Pick<ChatStore, "appendTree" | "currentTree" | "undoTree">;

export function treeMethods(d: TreeDeps): TreeMethods & { drop: (chatId: string) => void } {
  let all: StoredTree[] = [];
  const isLive = (chatId: string) => d.chats.get(chatId)?.deletedAt === null;
  const newest = (chatId: string, bookId: string) => [...all].reverse().find((t) => t.chatId === chatId && t.bookId === bookId && t.status === "live");
  return {
    drop: (chatId) => void (all = all.filter((t) => t.chatId !== chatId)),

    async appendTree(chatId, bookIdRaw, layoutRaw) {
      const bookId = checkText(bookIdRaw, "bookId");
      const layout = checkLayout(layoutRaw);
      if (!isLive(chatId)) return null;
      const tree: StoredTree = { id: d.newId(), chatId, bookId, at: d.clock(), status: "live", layout: structuredClone(layout) };
      all.push(tree);
      return structuredClone(tree);
    },

    async currentTree(chatId, bookId) {
      if (!isLive(chatId)) return null;
      const found = newest(chatId, checkText(bookId, "bookId"));
      return found ? structuredClone(found) : null;
    },

    async undoTree(chatId, bookIdRaw) {
      const bookId = checkText(bookIdRaw, "bookId");
      if (!isLive(chatId)) return null;
      const found = newest(chatId, bookId);
      if (found) all = all.map((t) => (t.id === found.id ? { ...t, status: "undone" } : t));
      const current = newest(chatId, bookId);
      return { undone: found !== undefined, current: current ? structuredClone(current) : null };
    },
  };
}
