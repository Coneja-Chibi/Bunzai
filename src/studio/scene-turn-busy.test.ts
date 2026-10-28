/**
 * A turn on a real library file while another connection holds the write lock (scene state, ChatStore rule 17): the save that
 * carries the turn's variable changes waits for the lock instead of giving up, and is awaited by the turn, so the reply never
 * commits without the variables it wrote.
 */
import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cellCipher } from "../stage/crypto/cell-cipher";
import { newDataKey, subkeys } from "../stage/crypto/crypto";
import type { Provider, ProviderCompletion } from "../stage/contracts/provider";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { sqliteChatStore } from "../stage/store/sqlite-chat-store";
import { MIGRATIONS } from "../stage/store/sqlite/migrations";
import { openStageDatabase } from "../stage/store/sqlite/database";
import { varsOf } from "../core/scene-state/vars-bridge";
import { runTurn, type Connected, type TurnEvent } from "./scene-turn";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } };
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const undo of cleanup.splice(0).reverse()) undo();
});

/** A turn on a real file whose second connection takes the write lock the moment the turn has opened its checkpoint, and frees it after `holdMs`. */
async function lockedTurn(holdMs: number) {
  const dir = mkdtempSync(join(tmpdir(), "bunraku-turn-busy-"));
  const path = join(dir, "bunraku.db");
  const database = openStageDatabase(path, MIGRATIONS);
  const keys = subkeys(newDataKey());
  const chats = sqliteChatStore(database, cellCipher(() => keys));
  const other = new Database(path);
  let held = false;
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  cleanup.push(() => database.close());
  cleanup.push(() => {
    if (held) other.run("ROLLBACK");
    other.close();
  });
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "{{setvar::asked::yes}}Any storms?" }]);
  const provider: Provider = { id: "fake", async send() { return { content: "It might.", finish_reason: "stop", raw: {} } as ProviderCompletion; } };
  let now = 1_000;
  let checkpointOpen = false;
  const deps = {
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }),
    readPreset: async () => null, readLorebook: async () => null, randomSeed: () => 7,
    // The first clock read after the checkpoint opened is the turn's own start: the next write it makes is the save carrying its variables.
    now: () => {
      if (!checkpointOpen) {
        checkpointOpen = true;
        other.run("BEGIN IMMEDIATE");
        held = true;
        setTimeout(() => {
          other.run("COMMIT");
          held = false;
        }, holdMs);
      }
      return (now += 10);
    },
  };
  const events: TurnEvent[] = [];
  const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
  await runTurn(deps, { chatId: chat.id, kind: "reply", expectedVersion: version }, (e) => events.push(e));
  return { chats, branch: chat.activeBranchId, events };
}

test("the reply lands with the variables it wrote when the library is locked for a moment as its first save goes out", async () => {
  const s = await lockedTurn(600);
  expect(s.events.map((e) => e.type)).toContain("done");
  expect(s.events.some((e) => e.type === "failed")).toBe(false);
  expect(varsOf(await s.chats.sceneState(s.branch)).get("asked")!.value).toBe("yes");
});
