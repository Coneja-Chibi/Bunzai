/**
 * The SQLite ChatStore's stored tree layouts: `compendium_trees`, where the
 * ids, the book, the status and the time stay readable and the layout is one sealed cell. The newest live row of a book is its
 * current layout; Undo marks it `undone` and the one before it shows again. Nothing here deletes a row.
 */
import type { ChatStore } from "../../contracts/chat-store";
import type { StoredTree, TreeStatus } from "../../contracts/chat-tree-types";
import { checkText } from "../chat-rules";
import { checkLayout } from "../tree-rules";
import type { ChatSqlKit } from "./chat-store-cuts";

interface TreeSql { id: string; chat_id: string; book_id: string; status: TreeStatus; at: number; cell: string }

const COLUMN = "compendium_trees.cell";
const COLUMNS = "id, chat_id, book_id, status, at, cell";

type TreeMethods = Pick<ChatStore, "appendTree" | "currentTree" | "undoTree">;

export function treeMethods(k: ChatSqlKit): TreeMethods {
  const toTree = (r: TreeSql): StoredTree => ({ id: r.id, chatId: r.chat_id, bookId: r.book_id, at: r.at, status: r.status, layout: JSON.parse(k.cipher.open(COLUMN, r.cell)) as StoredTree["layout"] });
  const newest = (chatId: string, bookId: string): TreeSql | undefined =>
    k.one<TreeSql>(`SELECT ${COLUMNS} FROM compendium_trees WHERE chat_id = ? AND book_id = ? AND status = 'live' ORDER BY seq DESC LIMIT 1`, chatId, bookId) ?? undefined;
  return {
    async appendTree(chatId, bookIdRaw, layoutRaw) {
      const bookId = checkText(bookIdRaw, "bookId");
      const layout = checkLayout(layoutRaw);
      return k.write(() => {
        if (!k.liveChat(chatId)) return null;
        const row: TreeSql = { id: k.newId(), chat_id: chatId, book_id: bookId, status: "live", at: k.clock(), cell: k.cipher.seal(COLUMN, JSON.stringify(layout)) };
        k.run("INSERT INTO compendium_trees (id, chat_id, book_id, status, at, cell) VALUES (?, ?, ?, ?, ?, ?)", row.id, chatId, bookId, row.status, row.at, row.cell);
        return toTree(row);
      });
    },

    async currentTree(chatId, bookId) {
      if (!k.liveChat(chatId)) return null;
      const row = newest(chatId, checkText(bookId, "bookId"));
      return row ? toTree(row) : null;
    },

    async undoTree(chatId, bookIdRaw) {
      const bookId = checkText(bookIdRaw, "bookId");
      return k.write(() => {
        if (!k.liveChat(chatId)) return null;
        const row = newest(chatId, bookId);
        if (row) k.run("UPDATE compendium_trees SET status = 'undone' WHERE id = ?", row.id);
        const current = newest(chatId, bookId);
        return { undone: row !== undefined, current: current ? toTree(current) : null };
      });
    },
  };
}
