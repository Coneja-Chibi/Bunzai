/**
 * A restore round-trips scene state (migrations 43 and 44): the deltas, the take's base and tip cache, and the writes made after a commit that are tied to a version, all come back as the snapshot had them,
 * and what was recorded after is gone. Split from snapshot-restore.test.ts for the file-size cap.
 */
import { afterEach, expect, test } from "bun:test";
import { varsOf } from "../../../core/scene-state/vars-bridge";
import { addChat, makeRig, type Rig } from "../fake-snapshot-rig";

const rigs: Rig[] = [];
const rig = async (...args: Parameters<typeof makeRig>) => {
  const r = await makeRig(...args);
  rigs.push(r);
  return r;
};
afterEach(() => {
  for (const r of rigs.splice(0)) r.close();
});

test("a restore round-trips scene state: the deltas and the take's state come back as the snapshot had them, and what was recorded after is gone", async () => {
  const r = await rig();
  const alpha = await addChat(r, "Alpha");
  const branch = (await r.chats.getChat(alpha))!.activeBranchId;
  const reply = (await r.chats.readMessages(branch, { limit: 10 })).messages[1]!;
  await r.chats.recordMessageDeltas(branch, reply.id, [{ slot: "vars", path: ["mood"], value: "calm", at: 1 }]);
  const turn = await r.chats.beginTurn(branch, { kind: "reply" });
  await r.chats.saveCheckpoint(turn!.id, { content: "r", deltas: [{ slot: "vars", path: ["n"], value: 1, at: 1 }] });
  await r.chats.commitTurn(turn!.id, { content: "reply" });
  await r.chats.setBranchBase(branch, [{ slot: "vars", path: ["start"], value: "first", at: 1 }]);
  const snap = await r.snapshots.take();
  const held = await r.chats.sceneState(branch);
  await r.chats.recordMessageDeltas(branch, reply.id, [{ slot: "vars", path: ["mood"], value: "stormy", at: 2 }, { slot: "vars", path: ["later"], value: 1, at: 2 }]);
  expect(varsOf(await r.chats.sceneState(branch)).get("mood")!.value).toBe("stormy");
  await r.chats.setBranchBase(branch, [{ slot: "vars", path: ["start"], value: "changed", at: 3 }]);
  await r.snapshots.restore(snap.id);
  expect(await r.chats.sceneState(branch)).toEqual(held);
  expect(varsOf(await r.chats.sceneState(branch)).get("start")!.value).toBe("first");
  expect(r.d.statement("SELECT count(*) AS n FROM branch_base").get()).toEqual({ n: 1 });
  expect(varsOf(await r.chats.sceneState(branch)).get("mood")!.value).toBe("calm");
  expect([r.d.statement("SELECT count(*) AS n FROM swipe_deltas").get(), r.d.statement("SELECT count(*) AS n FROM message_deltas").get()]).toEqual([{ n: 1 }, { n: 1 }]);
  // Nothing is left stale: a second take of the restored library rebuilds the same state from the restored deltas.
  const take = await r.chats.fork(branch, (await r.chats.readMessages(branch, { limit: 10 })).messages.at(-1)!.id);
  expect(await r.chats.sceneState(take!.id)).toEqual(held);
});

test("a restore round-trips a write made after a commit: its version stays tied, and one recorded after the snapshot is gone", async () => {
  const r = await rig();
  const alpha = await addChat(r, "Alpha");
  const branch = (await r.chats.getChat(alpha))!.activeBranchId;
  const reply = (await r.chats.readMessages(branch, { limit: 10 })).messages[1]!;
  const version = reply.swipes[reply.current]!.id;
  const line = (text: string) => [{ slot: "summary", path: [version], value: { version, text, through: 2, at: 5 }, at: 5 }];
  await r.chats.recordDeltas(branch, version, line("Turn 1: kept."));
  const snap = await r.snapshots.take();
  const held = await r.chats.sceneState(branch);
  await r.chats.recordDeltas(branch, version, line("Turn 1: changed."));
  expect((await r.chats.summaryOf(branch))!.text).toBe("Turn 1: changed.");
  await r.snapshots.restore(snap.id);
  expect(await r.chats.sceneState(branch)).toEqual(held);
  expect((await r.chats.summaryOf(branch))!.text).toBe("Turn 1: kept.");
  expect(r.d.statement("SELECT swipe_id FROM message_deltas WHERE swipe_id IS NOT NULL").all()).toEqual([{ swipe_id: version }]);
});
