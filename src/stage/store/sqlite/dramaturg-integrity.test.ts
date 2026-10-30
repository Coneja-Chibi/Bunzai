/** Damaged Dramaturg storage must remain visible as an error and survive ordinary writes unchanged. */
import { afterEach, expect, test } from "bun:test";
import { DamagedDataError } from "../../damaged-data-error";
import { sqliteChatStore } from "../sqlite-chat-store";
import { freshDatabase, testCipher } from "./test-support";
import type { StageDatabase } from "./database";

const open: StageDatabase[] = [];
afterEach(() => { for (const d of open.splice(0)) d.close(); });

test("malformed sealed records refuse reads and writes without silently erasing the conversation", async () => {
  for (const payload of ["not sealed", "{not json", JSON.stringify({ settings: {}, entries: "lost" }), JSON.stringify({ settings: { temperature: null }, entries: [] })]) {
    const d = freshDatabase(open), cipher = testCipher(), store = sqliteChatStore(d, cipher);
    const chat = await store.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { id: "vera" } } });
    await store.appendDramaturg(chat.id, [{ role: "user", text: "Why?" }], { expectedRevision: 0 });
    const bad = payload === "not sealed" ? payload : cipher.seal("dramaturg_threads.cell", payload);
    d.db.run("UPDATE dramaturg_threads SET cell = ? WHERE chat_id = ?", [bad, chat.id]);
    for (const operation of [() => store.getDramaturg(chat.id), () => store.clearDramaturg(chat.id), () => store.setDramaturgSettings(chat.id, { temperature: 1 }), () => store.appendDramaturg(chat.id, [{ role: "user", text: "Again?" }], { expectedRevision: 1 })]) {
      const error = await operation().then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(DamagedDataError);
      expect(d.db.query("SELECT cell FROM dramaturg_threads WHERE chat_id = ?").get(chat.id)).toEqual({ cell: bad });
    }
  }
});
