/** The encrypted rp-core journal survives a real turn and reopens without plaintext cells. */
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createScriptedProvider, Engine, SCRIPT_CAPS } from "rp-core";
import type { StageDatabase } from "./database";
import { freshDatabase, testCipher } from "./test-support";
import { sqliteCoreRecordStore } from "./core-record-store";

const open: StageDatabase[] = [];
const homes: string[] = [];
afterEach(() => {
  for (const db of open.splice(0)) db.close();
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

test("rp-core writes an encrypted journal and reopens the same conversation", async () => {
  const db = freshDatabase(open);
  const store = sqliteCoreRecordStore(db, testCipher());
  const home = mkdtempSync(join(tmpdir(), "bunzai-core-"));
  homes.push(home);
  const provider = createScriptedProvider([{ steps: [{ text: "The door opens." }] }]);
  const conn = { id: "script", provider, caps: SCRIPT_CAPS, origin: "script:test", local: true };
  const engine = await Engine.openWithRecordStore({ home, connections: { script: conn }, recordStore: store, lane: "manual" });
  const session = await engine.createSession({ character: { name: "Mira", description: "A guide.", greetings: ["Hello."] } });
  const sent = await session.send({ text: "Open the door.", expectedVersion: await session.version() });
  const turn = await session.runTurn({ kind: "reply", expectedVersion: sent.version });
  for await (const _ of turn.events) { /* drain */ }
  expect(await turn.result).toMatchObject({ type: "done" });
  const id = session.id;
  await engine.close();

  const cells = db.statement("SELECT entry_cell FROM core_entries WHERE session_id = ?").all(id) as { entry_cell: string }[];
  expect(cells.length).toBeGreaterThan(2);
  expect(cells.every((row) => !row.entry_cell.includes("The door opens"))).toBe(true);
  const reopened = await Engine.openWithRecordStore({ home, connections: { script: conn }, recordStore: store, lane: "manual" });
  const again = await reopened.session(id);
  expect((await again.view()).head).toBe(turn.messageId);
  await reopened.close();
});
