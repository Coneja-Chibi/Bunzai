/**
 * A chat log through the ONE import route: POST /api/inspect reads a .jsonl into a scene carrier,
 * save-bundle (or save-staged, past 8 MB) writes it into the ChatStore through createChat, over the real
 * handler and an encrypted library. Proves what the brief asks of it: the character is matched by name,
 * a missing one refuses the file and writes nothing, swipes, times and persona stamps land as read, and
 * the frozen cast is a normal new scene's (snapshot version 1).
 */
import { afterEach, describe, expect, test } from "bun:test";
import type { InspectResult, SaveBundleResult } from "./app-contract";
import type { OpenScene, SceneSummary } from "../studio/scenes";
import { chatRouteRig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";
import { libraryChatsFor } from "../studio/library-content";
import { freezeCast } from "../studio/scenes";
import { varsOf } from "../core/scene-state/vars-bridge";

afterEach(cleanupChatRouteRigs);

const bee = { schemaVersion: "1", kind: "persona", id: "bee", body: { name: "Bee", content: "A courier." } };
const rec = (o: unknown) => JSON.stringify(o);
const chatLines = (extra: unknown[] = []): string =>
  [
    rec({ user_name: "Bee", character_name: "Vera", create_date: "2025-6-24 @12h 43m 31s 310ms", chat_metadata: { integrity: "x" } }),
    rec({ name: "Vera", is_user: false, send_date: "June 24, 2025 6:22pm", mes: "Welcome back.", swipes: ["Hello.", "Welcome back."], swipe_id: 1, swipe_info: [{ send_date: "June 24, 2025 6:22pm", extra: {} }, { send_date: "June 24, 2025 6:25pm", extra: {} }], extra: {} }),
    rec({ name: "Bee", is_user: true, send_date: "June 24, 2025 6:30pm", mes: "Hi.", extra: {} }),
    rec({ name: "Vera", is_user: false, send_date: "June 24, 2025 6:31pm", mes: "A reply.", gen_started: "2025-06-24T22:30:50.000Z", gen_finished: "2025-06-24T22:31:00.500Z", extra: { model: "m1", reasoning: "thought" } }),
    ...extra.map(rec),
  ].join("\n") + "\n";

async function rig() {
  const r = await chatRouteRig();
  const inspect = async (text: string, name = "Vera - chat.jsonl") => {
    const req = apiReq("/api/inspect", { method: "POST", token: r.token, contentType: "application/octet-stream", body: new TextEncoder().encode(text) });
    req.headers.set("x-filename", encodeURIComponent(name));
    return (await (await r.handler(req)).json()) as InspectResult;
  };
  const save = async (inspected: InspectResult) => {
    const res = inspected.staged
      ? await r.post("/api/studio/save-staged", inspected.staged)
      : await r.post("/api/studio/save-bundle", { entity: inspected.entity });
    return { status: res.status, body: (await res.json()) as SaveBundleResult };
  };
  const scenes = async () => (await (await r.handler(apiReq("/api/chats/list"))).json()) as SceneSummary[];
  const open = async (id: string) => (await (await r.handler(apiReq(`/api/chats/open?id=${id}`))).json()) as OpenScene;
  return { ...r, inspect, save, scenes, open };
}

describe("a chat log, inspected and saved", () => {
  test("is read as a scene, matched to the card and persona by name, and opens as the story it was", async () => {
    const r = await rig();
    await r.store.save(vera);
    await r.store.save(bee);
    const inspected = await r.inspect(chatLines());
    expect(inspected).toMatchObject({ ok: true, kind: "scene", formatId: "sillytavern-chat" });
    expect(inspected.receipt).toMatchObject({ name: "Vera", kindLine: "A chat of 3 messages, made for SillyTavern." });
    const saved = await r.save(inspected);
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ ok: true, related: [], scene: { title: "Vera", messageCount: 3 } });
    expect(saved.body.primary).toBeUndefined();

    const [summary] = await r.scenes();
    expect(summary).toMatchObject({ characterName: "Vera", messageCount: 3, createdAt: new Date(2025, 5, 24, 12, 43, 31, 310).getTime() });
    const scene = await r.open(saved.body.scene!.sceneId);
    expect(scene.chat).toMatchObject({ snapshotVersion: 1, cast: { character: { id: "vera", version: 1, name: "Vera" }, persona: { id: "bee", name: "Bee" } } });
    expect(scene.snapshot.character).toMatchObject({ id: "vera", kind: "character" });
    expect(scene.messages.map((m) => [m.role, m.swipes[m.current]!.content, m.persona])).toEqual([
      ["assistant", "Welcome back.", undefined],
      ["user", "Hi.", { id: "bee", name: "Bee" }],
      ["assistant", "A reply.", undefined],
    ]);
    expect(scene.messages[0]).toMatchObject({ createdAt: new Date(2025, 5, 24, 18, 22).getTime() });
    expect(scene.messages[0]!.transcript).toMatchObject({ swipeCount: 2, currentIndex: 1 });
    expect(scene.messages[2]!.swipes[0]!.generation).toEqual({ model: "m1", generationMs: 10_500, reasoning: { text: "thought", model: "m1" } });
  });

  test("a character that is not in the library refuses that file, says why, and writes nothing", async () => {
    const r = await rig();
    const inspected = await r.inspect(chatLines());
    expect(inspected.ok).toBe(true); // the card may be in the same drop: the library is only asked when it saves
    const saved = await r.save(inspected);
    expect(saved.status).toBe(422);
    expect(saved.body).toMatchObject({ ok: false, error: 'its character, "Vera", is not in your library. Import the card first, then this chat.' });
    expect(await r.scenes()).toEqual([]);
  });

  test("two cards with the character's name refuse it rather than guess", async () => {
    const r = await rig();
    await r.store.save(vera);
    await r.store.save({ ...vera, id: "vera-2" });
    const saved = await r.save(await r.inspect(chatLines()));
    expect(saved.body.error).toContain("2 characters in your library are called");
    expect(await r.scenes()).toEqual([]);
  });

  test("a header that names the card as it was before a rename is only a fallback: the replies' speaker decides", async () => {
    const r = await rig();
    await r.store.save(vera);
    await r.store.save({ ...vera, id: "vera-old", body: { ...vera.body, identity: { ...vera.body.identity, name: "Vera Before" } } });
    const stale = chatLines().replace('"character_name":"Vera"', '"character_name":"Vera Before"');
    const saved = await r.save(await r.inspect(stale));
    expect(saved.body).toMatchObject({ ok: true });
    expect((await r.open(saved.body.scene!.sceneId)).chat.cast.character.id).toBe("vera");
  });

  test("names that differ only by punctuation, case or spacing are the same card; replies under two different library cards are refused", async () => {
    const r = await rig();
    await r.store.save({ ...vera, body: { ...vera.body, identity: { ...vera.body.identity, name: "Vera Between Two Earths" } } });
    await r.store.save({ ...vera, id: "other", body: { ...vera.body, identity: { ...vera.body.identity, name: "Someone Else" } } });
    const named = (speaker: string, extra: unknown[] = []) => chatLines(extra).replaceAll('"name":"Vera"', `"name":"${speaker}"`);
    expect((await r.save(await r.inspect(named("VERA:  between two earths!")))).body.ok).toBe(true);
    const two = named("Vera Between Two Earths", [{ name: "Someone Else", is_user: false, send_date: "June 24, 2025 6:40pm", mes: "x", extra: {} }]);
    const refused = await r.save(await r.inspect(two));
    expect(refused.body.error).toContain("more than one character");
    expect(await r.scenes()).toHaveLength(1);
  });

  test("the same chat twice is the same scene: the second is refused", async () => {
    const r = await rig();
    await r.store.save(vera);
    const first = await r.save(await r.inspect(chatLines()));
    expect(first.status).toBe(200);
    const again = await r.save(await r.inspect(chatLines()));
    expect(again.status).toBe(422);
    expect(again.body.error).toContain("already in your scenes");
    expect(again.body.alreadyImported).toEqual({ sceneId: first.body.scene!.sceneId, title: "Vera" });
    expect(await r.scenes()).toHaveLength(1);
  });

  test("a chat with another start time is another scene", async () => {
    const r = await rig();
    await r.store.save(vera);
    const first = await r.save(await r.inspect(chatLines()));
    const changedStart = chatLines().replace("2025-6-24 @12h 43m 31s 310ms", "2025-6-24 @12h 43m 32s 310ms");
    const other = await r.save(await r.inspect(changedStart));
    expect(other.body).toMatchObject({ ok: true, scene: { messageCount: 3 } });
    expect(other.body.scene!.sceneId).not.toBe(first.body.scene!.sceneId);
    expect(await r.scenes()).toHaveLength(2);
  });

  test("a scene saved before sources were recorded still counts as that chat, and is the one named", async () => {
    const r = await rig();
    await r.store.save(vera);
    const frozen = await freezeCast(r.store, "vera", undefined);
    const msg = (role: "assistant" | "user", at: number) => ({ role, createdAt: at, current: 0, swipes: [{ content: "x", createdAt: at }] });
    const start = new Date(2025, 5, 24, 12, 43, 31, 310).getTime();
    const legacy = await libraryChatsFor(r.store.studioPath())!.createChat({ ...frozen, history: { createdAt: start, updatedAt: start, messages: [msg("assistant", start), msg("user", start), msg("assistant", start)] } });
    const again = await r.save(await r.inspect(chatLines()));
    expect(again.status).toBe(422);
    expect(again.body.alreadyImported).toEqual({ sceneId: legacy.id, title: "Vera" });
    expect(await r.scenes()).toHaveLength(1);
  });

  test("a persona the library does not have leaves the lines unstamped and the scene without one", async () => {
    const r = await rig();
    await r.store.save(vera);
    const saved = await r.save(await r.inspect(chatLines()));
    const scene = await r.open(saved.body.scene!.sceneId);
    expect(scene.chat.cast.persona).toBeUndefined();
    expect(scene.messages[1]!.persona).toBeUndefined();
  });

  test("a group chat and a file that is not a chat are refused at inspect, in plain words", async () => {
    const r = await rig();
    const group = await r.inspect(chatLines([{ name: "Icarus", is_user: false, send_date: "June 24, 2025 6:40pm", mes: "x", is_group: true }]));
    expect(group.ok).toBe(false);
    expect(group.error).toContain("group chat");
    const junk = await r.inspect("not a chat at all\n");
    expect(junk).toMatchObject({ ok: false });
    expect(junk.error).toContain("not a SillyTavern chat log");
  });

  test("a malformed carrier is refused at save, and a locked-out write is not attempted", async () => {
    const r = await rig();
    await r.store.save(vera);
    const res = await r.post("/api/studio/save-bundle", { entity: { kind: "scene", id: "x", body: { messages: [] } } });
    expect(res.status).toBe(422);
    expect(((await res.json()) as SaveBundleResult).error).toContain("not in a shape");
    expect(await r.scenes()).toEqual([]);
  });

  test("a chat past 8 MB stages on disk, commits by reference, and reads back whole", async () => {
    const r = await rig();
    await r.store.save(vera);
    const big = "x".repeat(20_000);
    const extra = Array.from({ length: 450 }, (_, i) => ({ name: i % 2 ? "Bee" : "Vera", is_user: i % 2 === 1, send_date: "June 25, 2025 6:00pm", mes: `${i}${big}`, extra: {} }));
    const inspected = await r.inspect(chatLines(extra));
    expect(inspected.staged).toBeDefined();
    expect(inspected.entity).toBeUndefined();
    const saved = await r.save(inspected);
    expect(saved.body).toMatchObject({ ok: true, scene: { messageCount: 453 } });
    const scene = await r.open(saved.body.scene!.sceneId);
    expect(scene.messageCount).toBe(453);
  });
});

const stPersona = (id: string, name: string, avatar: string) => ({ schemaVersion: "1", kind: "persona", id, body: { name, content: "x" }, original: { "sillytavern-persona": { raw: {}, unmapped: { avatarId: avatar } } } });
const chiLine = (avatar: string, mes: string, extra: object = {}) => rec({ name: "Chi", is_user: true, send_date: "June 24, 2025 6:40pm", mes, force_avatar: `/thumbnail?type=persona&file=${avatar}`, extra, ...extra });

describe("a chat with hidden lines, persona avatars and variables", () => {
  test("two personas that share a name are told apart by the avatar file the line was written with", async () => {
    const r = await rig();
    await r.store.save(vera);
    await r.store.save(stPersona("chi-a", "Chi (1111-Chi)", "1111-Chi.png"));
    await r.store.save(stPersona("chi-b", "Chi (2222-Chi)", "2222-Chi.png"));
    const text = chatLines([JSON.parse(chiLine("1111-Chi.png", "as a")), JSON.parse(chiLine("2222-Chi.png", "as b")), JSON.parse(chiLine("9999-Nobody.png", "as nobody"))]);
    const saved = await r.save(await r.inspect(text));
    expect(saved.body.ok).toBe(true);
    const scene = await r.open(saved.body.scene!.sceneId);
    const stamped = scene.messages.filter((m) => m.role === "user").map((m) => [m.swipes[0]!.content, m.persona?.id]);
    expect(stamped).toEqual([["Hi.", undefined], ["as a", "chi-a"], ["as b", "chi-b"], ["as nobody", undefined]]);
    // The scene plays the most recent line that names a library persona.
    expect(scene.chat.cast.persona).toMatchObject({ id: "chi-b" });
  });

  test("lines hidden in SillyTavern are hidden here, and hiding and showing round-trips through the scene route", async () => {
    const r = await rig();
    await r.store.save(vera);
    const hiddenLine = { name: "Vera", is_user: false, is_system: true, send_date: "June 24, 2025 6:45pm", mes: "an aside", extra: {} };
    const inspected = await r.inspect(chatLines([hiddenLine]));
    expect(inspected.receipt!.extras).toContain("1 message was hidden from the prompt in SillyTavern and stays hidden here.");
    const saved = await r.save(inspected);
    const scene = await r.open(saved.body.scene!.sceneId);
    expect(scene.messages.map((m) => m.hidden)).toEqual([undefined, undefined, undefined, true]);
    const show = await r.post("/api/chats/hide", { chatId: scene.chat.id, messageId: scene.messages[3]!.id, hidden: false, expectedVersion: scene.branchVersion });
    const shown = (await show.json()) as OpenScene;
    expect(shown.messages[3]!.hidden).toBeUndefined();
    expect(shown.branchVersion).toBe(scene.branchVersion + 1);
    const hide = await r.post("/api/chats/hide", { chatId: scene.chat.id, messageId: scene.messages[0]!.id, hidden: true, expectedVersion: shown.branchVersion });
    expect(((await hide.json()) as OpenScene).messages[0]!.hidden).toBe(true);
    expect((await r.post("/api/chats/hide", { chatId: scene.chat.id, messageId: scene.messages[0]!.id, hidden: false, expectedVersion: 1 })).status).toBe(409);
    expect((await r.post("/api/chats/hide", { chatId: scene.chat.id, messageId: scene.messages[0]!.id, hidden: "no", expectedVersion: 1 })).status).toBe(400);
  });

  test("a message of another scene cannot be hidden through this one", async () => {
    const r = await rig();
    await r.store.save(vera);
    const a = (await r.save(await r.inspect(chatLines()))).body.scene!.sceneId;
    const b = (await r.save(await r.inspect(chatLines([{ name: "Vera", is_user: false, send_date: "June 25, 2025 6:45pm", mes: "later", extra: {} }]).replace("2025-6-24", "2025-6-23")))).body.scene!.sceneId;
    const [sa, sb] = [await r.open(a), await r.open(b)];
    const res = await r.post("/api/chats/hide", { chatId: sb.chat.id, messageId: sa.messages[0]!.id, hidden: true, expectedVersion: sb.branchVersion });
    expect(res.status).toBe(404);
    expect((await r.open(a)).messages[0]!.hidden).toBeUndefined();
  });

  test("chat variables become the take's variables", async () => {
    const r = await rig();
    await r.store.save(vera);
    const saved = await r.save(await r.inspect(chatLines().replace('"integrity":"x"', '"integrity":"x","variables":{"mood":"calm","turn":"3"}')));
    const chats = libraryChatsFor(r.store.studioPath())!;
    const vars = varsOf(await chats.sceneState((await r.open(saved.body.scene!.sceneId)).chat.activeBranchId));
    expect(Object.fromEntries([...vars].map(([k, v]) => [k, v.value]))).toEqual({ mood: "calm", turn: "3" });
    // They ride on the first message, not on the greeting it shows, so choosing the other greeting keeps them.
    const opened = await r.open(saved.body.scene!.sceneId);
    await chats.selectSwipe(opened.messages[0]!.id, 0);
    expect(Object.fromEntries([...varsOf(await chats.sceneState(opened.chat.activeBranchId))].map(([k, v]) => [k, v.value]))).toEqual({ mood: "calm", turn: "3" });
  });
});
