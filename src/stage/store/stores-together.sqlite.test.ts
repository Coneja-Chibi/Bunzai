/**
 * The library and chats on one database, the way the app runs them. Neither contract suite can see
 * this: a chat must keep working after the library prunes or purges the card it started from,
 * because the chat holds its own frozen copy.
 */
import { afterEach, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { createContentStore } from "./content-store";
import { type StageDatabase } from "./sqlite/database";
import { sqliteChatStore } from "./sqlite-chat-store";
import { sqliteDocumentBackend } from "./sqlite/document-backend";
import { freshDatabase, testCipher } from "./sqlite/test-support";

const open: StageDatabase[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
});

const vera = (name: string) => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "character",
  id: "vera",
  body: { identity: { name }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
});

test("a chat outlives the library pruning and purging the card version it started from", async () => {
  const d = freshDatabase(open);
  let now = 1_000;
  const clock = () => now++;
  const library = createContentStore(sqliteDocumentBackend(d, testCipher()), clock, { keepVersions: 3 });
  const chats = sqliteChatStore(d, testCipher(), clock);

  await library.save(vera("Vera, as she began"));
  const started = await library.read("character", "vera");
  const chat = await chats.createChat({
    title: "Night market",
    cast: { character: { id: "vera", version: started!.version } },
    snapshot: { character: JSON.parse(JSON.stringify(started!.entity)) },
  });

  for (let n = 1; n <= 4; n++) await library.save(vera(`Vera, edit ${n}`), { overwrite: true });
  expect(await library.readVersion("character", "vera", started!.version)).toBeNull();

  await library.delete("character", "vera");
  now = 10_000_000;
  expect(await library.purge(now)).toBe(1);
  expect(await library.read("character", "vera")).toBeNull();

  const kept = await chats.castSnapshot(chat.id);
  expect((kept?.character as { body: { identity: { name: string } } }).body.identity.name).toBe("Vera, as she began");
  expect((await chats.getChat(chat.id))?.cast.character).toEqual({ id: "vera", version: started!.version });
});
