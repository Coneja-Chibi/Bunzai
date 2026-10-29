/**
 * Regression: an ORDER BY on a timestamp alone with no tiebreaker makes a listing's order for tied
 * rows unstable (it could reshuffle between calls or across pages). Bunzai's listChats already
 * orders by `created_at, rowid` (src/stage/store/sqlite/chat-store.ts), so ties break on insertion
 * order.
 */
import { afterEach, expect, test } from "bun:test";
import { type StageDatabase } from "./sqlite/database";
import { sqliteChatStore } from "./sqlite-chat-store";
import { freshDatabase, testCipher } from "./sqlite/test-support";

const open: StageDatabase[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
});
const fresh = () => freshDatabase(open);

const CAST = { character: { id: "vera", version: 1 } };
const SNAP = { character: { id: "vera" } };

test("chats created in the same instant list in a stable, deterministic order", async () => {
  const sameInstant = () => 1_000; // every chat below gets the identical created_at
  const store = sqliteChatStore(fresh(), testCipher(), sameInstant);
  const a = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
  const b = await store.createChat({ title: "B", cast: CAST, snapshot: SNAP });
  const c = await store.createChat({ title: "C", cast: CAST, snapshot: SNAP });

  const first = (await store.listChats()).chats;
  const second = (await store.listChats()).chats;
  expect(first.map((chat) => chat.id)).toEqual([a.id, b.id, c.id]);
  expect(second.map((chat) => chat.id)).toEqual(first.map((chat) => chat.id));
  expect(new Set(first.map((chat) => chat.createdAt))).toEqual(new Set([1_000]));
});
