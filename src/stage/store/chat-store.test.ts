/** Runs the ChatStore contract suite against the in-memory implementation, plus what the contract cannot see: that a purge drops a scene's Dramaturg record. */
import { expect, test } from "bun:test";
import { chatStoreContract } from "../contracts/chat-store.contract";
import { CAST, SNAP } from "../contracts/chat-store.contract-rig";
import { memoryChatStore } from "./chat-store";

chatStoreContract("memory", (clock) => memoryChatStore(clock));

test("a purge drops the scene's Dramaturg record (rule 48): a scene that later gets the same id starts with none", async () => {
  let n = 0;
  let now = 1_000;
  const store = memoryChatStore(() => now, () => `id-${n++}`);
  const gone = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
  await store.appendDramaturg(gone.id, [{ role: "user", text: "why" }], { expectedRevision: 0 });
  now = 2_000;
  await store.deleteChat(gone.id);
  expect(await store.purgeChats(3_000)).toBe(1);
  n = 0;
  const reborn = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
  expect(reborn.id).toBe(gone.id);
  expect(await store.getDramaturg(reborn.id)).toEqual({ settings: {}, entries: [], revision: 0 });
});
