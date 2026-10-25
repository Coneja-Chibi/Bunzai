/**
 * When filing happens and what takes it back (04b D6, D7): the newest reply waits for the person's next message, a regenerate or a
 * cut of a filed reply undoes its filings at any wait setting, a restore never files again, and a failure to undo never blocks the
 * cut. Events are fed to `onTurnEvent` as the turn route would, and the scene's lane is awaited, on a real library.
 */
import { describe, expect, test } from "bun:test";
import type { ChatCompendiumPatch, Message } from "../stage/contracts/chat-store";
import { onTurnEvent, filingsUnderCut, filingsOfVersion, undoWithCut } from "./compendium-hooks";
import { fileReply } from "./compendium-filing";
import { settled } from "./compendium-queue";
import { answer, compendiumRig } from "./fake-compendium-rig";

const create = (name: string) => ({ type: "location", entry: { name } });
const BOOKS = { on: true, books: { bk: { access: "read_write" as const } } };

async function rig(config: ChatCompendiumPatch = BOOKS) {
  const r = await compendiumRig(config);
  const send = async (text: string) => (await r.chats.appendMessage(r.chat.activeBranchId, { role: "user", content: text }))!;
  const say = async (text: string): Promise<Message> => (await r.chats.appendMessage(r.chat.activeBranchId, { role: "assistant", content: text }))!;
  const event = async (kind: "reply" | "swipe" | "continue", e: Parameters<typeof onTurnEvent>[3]) => {
    onTurnEvent(r.deps, r.chat.id, kind, e);
    await settled(r.chat.id);
  };
  const receipts = async () => (await r.chats.listReceipts(r.chat.id)).reverse();
  return { ...r, send, say, event, receipts, start: () => event("reply", { type: "start", turnId: "t", kind: "reply", messageId: null }) };
}

describe("when a reply is filed", () => {
  test("the newest reply waits: landing files nothing, and the person's next message files it", async () => {
    const r = await rig();
    r.script.push(answer(create("Dock Ward")));
    await r.event("reply", { type: "done", message: r.reply });
    expect(await r.receipts()).toEqual([]);
    expect(r.requests).toHaveLength(0);

    await r.send("And then?");
    await r.start();
    const [filing] = await r.receipts();
    expect(filing).toMatchObject({ kind: "filing", status: "filed", messageId: r.reply.id, swipeId: r.reply.swipes[0]!.id });
    expect(r.requests[0]!.messages[1]!.content).toContain("Wolfman howls at the lamp.");
    expect((await r.entries()).map((e) => e.title)).toContain("Dock Ward");
  });

  test("a second start for the same reply files nothing more", async () => {
    const r = await rig();
    await r.send("And then?");
    await r.start();
    await r.start();
    expect(r.requests).toHaveLength(1);
    expect(await r.receipts()).toHaveLength(1);
  });

  test("swipes and continues never file, whatever the wait", async () => {
    const r = await rig({ ...BOOKS, filing: { wait: 0 } });
    await r.event("swipe", { type: "start", turnId: "t", kind: "swipe", messageId: r.reply.id });
    await r.event("continue", { type: "done", message: r.reply });
    expect(r.requests).toHaveLength(0);
  });

  test("a wait of 2 files the second newest assistant reply, which here is the greeting", async () => {
    const r = await rig({ ...BOOKS, filing: { wait: 2 } });
    await r.send("And then?");
    await r.start();
    const [filing] = await r.receipts();
    const greeting = (await r.chats.readMessages(r.chat.activeBranchId, { limit: 1 })).messages[0]!;
    expect(filing!.messageId).toBe(greeting.id);
  });

  test("with a wait of 0 a reply is filed as it lands", async () => {
    const r = await rig({ ...BOOKS, filing: { wait: 0 } });
    r.script.push(answer(create("Dock Ward")));
    await r.event("reply", { type: "done", message: r.reply });
    expect((await r.receipts())[0]).toMatchObject({ status: "filed", messageId: r.reply.id });
    await r.event("reply", { type: "start", turnId: "t", kind: "reply", messageId: null });
    expect(r.requests).toHaveLength(1);
  });

  test("only every Nth of the person's turns files", async () => {
    const r = await rig({ ...BOOKS, filing: { everyN: 3 } });
    await r.send("two");
    await r.start();
    expect(await r.receipts()).toEqual([]);
    await r.say("a second reply");
    await r.send("three");
    await r.start();
    expect(await r.receipts()).toHaveLength(1);
    expect(r.requests[0]!.messages[1]!.content).toContain("a second reply");
  });

  test("a scene with the Compendium off files nothing", async () => {
    const r = await rig({ on: false });
    await r.send("And then?");
    await r.start();
    expect(await r.receipts()).toEqual([]);
  });
});

describe("a regenerate undoes the filings of the version it replaces", () => {
  test("the old version's filing is undone, and under a wait of 0 the new version is filed", async () => {
    const r = await rig({ ...BOOKS, filing: { wait: 0 } });
    r.script.push(answer(create("Dock Ward")), answer(create("Salt Flats")));
    await r.event("reply", { type: "done", message: r.reply });
    expect((await r.entries()).map((e) => e.title)).toContain("Dock Ward");

    const swiped = (await r.chats.addSwipe(r.reply.id, { content: "A different reply." }))!;
    await r.event("swipe", { type: "done", message: swiped });
    const all = await r.receipts();
    expect(all.map((x) => [x.kind, x.status])).toEqual([["filing", "undone"], ["undo", "filed"], ["filing", "filed"]]);
    const titles = (await r.entries()).map((e) => [e.title, e.enabled]);
    expect(titles).toContainEqual(["Dock Ward", false]);
    expect(titles).toContainEqual(["Salt Flats", true]);
  });

  test("under the default wait the new version is not filed until the next message", async () => {
    const r = await rig();
    r.script.push(answer(create("Dock Ward")));
    await r.send("next");
    await r.start();
    const swiped = (await r.chats.addSwipe(r.reply.id, { content: "A different reply." }))!;
    await r.event("swipe", { type: "done", message: swiped });
    expect((await r.receipts()).map((x) => [x.kind, x.status])).toEqual([["filing", "undone"], ["undo", "filed"]]);
    expect(r.requests).toHaveLength(1);
  });
});

describe("a cut takes back what the cut reply filed", () => {
  async function filedTwo() {
    const r = await rig();
    r.script.push(answer(create("Dock Ward")), answer(create("Salt Flats")));
    await fileReply(r.deps, r.target);
    const later = await r.say("Another reply.");
    await fileReply(r.deps, { ...r.target, messageId: later.id, swipeId: later.swipes[0]!.id, reply: "Another reply." });
    return { ...r, later };
  }

  test("cutting one older filed reply undoes only its filings", async () => {
    const r = await filedTwo();
    const cut = await undoWithCut(r.deps, r.chat.id, () => filingsUnderCut(r.deps, r.chat.id, r.chat.activeBranchId, r.reply.id, "one"), () => r.chats.cutMessages(r.chat.activeBranchId, r.reply.id, "one"));
    expect(cut).not.toBeNull();
    const byMessage = (await r.receipts()).filter((x) => x.kind === "filing").map((x) => [x.messageId === r.reply.id, x.status]);
    expect(byMessage).toEqual([[true, "undone"], [false, "filed"]]);
    const titles = (await r.entries()).map((e) => [e.title, e.enabled]);
    expect(titles).toContainEqual(["Dock Ward", false]);
    expect(titles).toContainEqual(["Salt Flats", true]);
  });

  test("a 'from here' cut undoes every filing in its range", async () => {
    const r = await filedTwo();
    await undoWithCut(r.deps, r.chat.id, () => filingsUnderCut(r.deps, r.chat.id, r.chat.activeBranchId, r.reply.id, "from"), () => r.chats.cutMessages(r.chat.activeBranchId, r.reply.id, "from"));
    expect((await r.receipts()).filter((x) => x.kind === "filing").map((x) => x.status)).toEqual(["undone", "undone"]);
  });

  test("cutting one version undoes that version's filing alone", async () => {
    const r = await filedTwo();
    const swiped = (await r.chats.addSwipe(r.reply.id, { content: "Second version." }))!;
    const first = r.reply.swipes[0]!.id;
    await undoWithCut(r.deps, r.chat.id, () => filingsOfVersion(r.deps, r.chat.id, r.chat.activeBranchId, r.reply.id, first), () => r.chats.cutSwipe(r.reply.id, first));
    expect(swiped.swipes).toHaveLength(2);
    expect((await r.receipts()).filter((x) => x.kind === "filing").map((x) => x.status)).toEqual(["undone", "filed"]);
  });

  test("a cut that does not land (a stale version) undoes nothing", async () => {
    const r = await filedTwo();
    const result = await undoWithCut(r.deps, r.chat.id, () => filingsUnderCut(r.deps, r.chat.id, r.chat.activeBranchId, r.reply.id, "one"), async () => null);
    expect(result).toBeNull();
    expect((await r.receipts()).filter((x) => x.kind === "filing").map((x) => x.status)).toEqual(["filed", "filed"]);
  });

  test("restoring the cut puts the reply back without filing it again, and the undone receipt is still there", async () => {
    const r = await filedTwo();
    const cut = (await undoWithCut(r.deps, r.chat.id, () => filingsUnderCut(r.deps, r.chat.id, r.chat.activeBranchId, r.reply.id, "one"), () => r.chats.cutMessages(r.chat.activeBranchId, r.reply.id, "one")))!;
    await r.chats.restoreCut(r.chat.activeBranchId, cut.cutId);
    await r.send("again");
    await r.event("reply", { type: "start", turnId: "t", kind: "reply", messageId: null });
    expect(r.requests).toHaveLength(2);
    expect((await r.receipts()).filter((x) => x.kind === "filing" && x.messageId === r.reply.id).map((x) => x.status)).toEqual(["undone"]);
  });

  test("a filing that cannot be undone never blocks the cut: it is reported in Activity", async () => {
    const r = await filedTwo();
    const person = (await r.library.read("lorebook", "bk")) as unknown as { body: { entries: { title: string; metadata?: Record<string, unknown> }[] } };
    await r.library.save({ ...person, body: { ...person.body, entries: person.body.entries.map((e) => (e.title === "Dock Ward" ? { ...e, content: "rewritten", metadata: { ...e.metadata, structured_data: { name: "Dock Ward", climate: "dry" } } } : e)) } }, { overwrite: true });
    const cut = await undoWithCut(r.deps, r.chat.id, () => filingsUnderCut(r.deps, r.chat.id, r.chat.activeBranchId, r.reply.id, "one"), () => r.chats.cutMessages(r.chat.activeBranchId, r.reply.id, "one"));
    expect(cut).not.toBeNull();
    const undo = (await r.receipts()).find((x) => x.kind === "undo")!;
    expect(undo).toMatchObject({ status: "failed" });
    expect(undo.reason).toContain("edited since");
    expect((await r.receipts()).find((x) => x.kind === "filing")!.status).toBe("filed");
  });

  test("undoing one take's filings leaves another take's alone", async () => {
    const r = await filedTwo();
    const take = (await r.chats.fork(r.chat.activeBranchId, r.reply.id, { name: "Take 2" }))!;
    const other = (await r.chats.readMessages(take.id, { limit: 10 })).messages.at(-1)!;
    r.script.push(answer(create("Reef")));
    await fileReply(r.deps, { ...r.target, branchId: take.id, messageId: other.id, swipeId: other.swipes[0]!.id });
    await undoWithCut(r.deps, r.chat.id, () => filingsUnderCut(r.deps, r.chat.id, r.chat.activeBranchId, r.reply.id, "from"), () => r.chats.cutMessages(r.chat.activeBranchId, r.reply.id, "from"));
    const mine = await r.chats.listReceipts(r.chat.id, { branchId: take.id });
    expect(mine.filter((x) => x.kind === "filing").map((x) => x.status)).toEqual(["filed"]);
  });
});
