/**
 * The throwaway studio theme:measure screenshots: a real handler over a library folder inside `work`, a fake
 * model that streams canned prose, and enough seeded pieces and one chat that every app has content.
 * BUNZAI_HOME is pointed at `work` before anything loads, so A real studio is never opened.
 */
import { mkdirSync } from "node:fs";

export interface Studio { url: string; chatId: string; close: () => void }

const OFFSET = Number(process.env.THEME_MEASURE_PORT_OFFSET ?? 0);
const PORT = 8481 + OFFSET;
const MODEL = 8482 + OFFSET;
const PROSE = [
  'The lamp room hummed with the storm. *Marguerite set the kettle down and did not look up.* "You came by the cliff path," she said. "Nobody comes by the cliff path."\n\nShe wiped her hands on her coat and finally met your eyes. The gaze was level, tired, kind in the way that costs something.',
  '*She turned the great lens a quarter turn.* "Sit, then. The tide takes its time, and so do I."\n\n"There is bread, and there is the truth," she added, "and I am short of the first."',
  '"Keep the light lit," *she murmured, mostly to herself.* "That was the only promise I ever kept."',
];

export async function startStudio(work: string): Promise<Studio> {
  const home = `${work}/home`;
  const root = `${work}/root`;
  mkdirSync(root, { recursive: true });
  process.env.BUNZAI_HOME = home;
  const { SettingsStore } = await import("../../src/studio/settings");
  const { StudioStore } = await import("../../src/studio/store");
  const { createHandler, createSecurityContext } = await import("../../src/ui/server");
  const { createLibrary } = await import("../../src/ui/library-root");
  const { fakeComputer } = await import("../../src/stage/crypto/fake-device-vault");
  const { saveProvider } = await import("../../src/kit/providers/vault");
  const { CANONICAL_SCHEMA_VERSION: sv } = await import("../../src/core/canonical");
  const { emptyLoreEntry, emptyLorebookBody } = await import("../../src/core/lore");

  let n = 0;
  const model = Bun.serve({ port: MODEL, idleTimeout: 120, async fetch(req) {
    if (req.method === "GET") return Response.json({ data: [{ id: "fake-model" }] });
    const body = (await req.json()) as { messages: { content: string }[] };
    const slow = /slow/i.test(body.messages.at(-1)?.content ?? "");
    const words = PROSE[n++ % PROSE.length]!.split(/(?<= )/);
    const enc = new TextEncoder();
    return new Response(new ReadableStream({ async start(c) {
      const send = (o: unknown) => c.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      for (const w of words) { send({ choices: [{ delta: { content: w } }] }); if (slow) await Bun.sleep(900); }
      send({ choices: [{ delta: {}, finish_reason: "stop" }], model: "fake-model" });
      send({ choices: [], usage: { prompt_tokens: 40, completion_tokens: 30 } });
      c.enqueue(enc.encode("data: [DONE]\n\n")); c.close();
    } }), { headers: { "content-type": "text/event-stream" } });
  } });

  const library = createLibrary(root, { vault: fakeComputer(), sessionsDir: `${root}/sessions` });
  await library.open();
  const store = new StudioStore(root);
  const settings = new SettingsStore(root);
  const sec = createSecurityContext();
  sec.expectedHost = `127.0.0.1:${PORT}`;
  sec.expectedOrigin = `http://127.0.0.1:${PORT}`;
  const handler = createHandler(store, settings, undefined, sec, undefined, undefined, undefined, undefined, undefined, undefined, undefined, library);
  const server = Bun.serve({ port: PORT, hostname: "127.0.0.1", idleTimeout: 120, fetch: handler });
  const headers = { host: `127.0.0.1:${PORT}`, origin: `http://127.0.0.1:${PORT}`, "x-bunzai-token": sec.token, "content-type": "application/json" };
  const post = (path: string, body: unknown) => handler(new Request(`http://127.0.0.1:${PORT}${path}`, { method: "POST", headers, body: JSON.stringify(body) }));

  await store.save({ schemaVersion: sv, kind: "character", id: "marguerite", body: {
    identity: { name: "Marguerite Vane", tagline: "Keep the lighthouse lit through the long storm." }, persona: {}, prompts: {},
    greetings: { firstMessage: "The door bangs open and wet wind fills the lamp room. *Marguerite looks up from the logbook.* \"You are late. The storm is not.\"", alternateGreetings: [{ text: "Evening." }] },
    examples: {}, attribution: {}, discovery: {}, media: {},
  } });
  await settings.update({ "persona.default": "chi", setupComplete: true });
  await store.save({ schemaVersion: sv, kind: "pack", id: "faces", body: { name: "Marguerite Faces", brief: "Lamp room expressions", pack: { items: [], enabled: true } } });
  await store.save({ schemaVersion: sv, kind: "htmldoc", id: "sketch", body: { name: "Lamp Room Sketch", summary: "A lighthouse at dusk", html: "<body style=\"background:#123\"><h1 style=\"color:#fc6\">Light</h1></body>" } });
  await store.save({ schemaVersion: sv, kind: "persona", id: "chi", body: { name: "Chi", content: "A traveller with a lantern.", identity: { tagline: "Always late", pronouns: "she/her" }, sections: { personality: "Dry, patient." } } });
  const block = (id: string, name: string, content: string) => ({ id, name, content, role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false });
  const prompts = Array.from({ length: 60 }, (_, i) => block(`b${i}`, i === 0 ? "Main prompt" : `Block ${i}: ${["Style guide", "Scene rules", "Character voice", "Pacing", "Formatting"][i % 5]}`, "Write in third person, past tense. Keep the lamp room lit and the dialogue spare.".repeat(1 + (i % 3))));
  await store.save({ schemaVersion: sv, kind: "preset", id: "house", body: { name: "House Style", description: "The default narrator voice for the lighthouse stories.", samplers: { temperature: 0.8, topP: 0.95, maxTokens: 800 }, prompts } });
  const lore = emptyLorebookBody("Lighthouse Atlas");
  await store.save({ schemaVersion: sv, kind: "lorebook", id: "atlas", body: { ...lore, entries: Array.from({ length: 40 }, (_, i) => ({ ...emptyLoreEntry(`e${i}`), title: ["Harbor", "Lighthouse", "Marguerite Vane", "The Cliff Path", "Storm Season"][i % 5] + (i >= 5 ? ` ${i}` : ""), content: "Salt, rope and a very tall lamp. The keeper has not left the tower since the winter of the long storm.", triggers: [{ keyword: ["harbor", "lamp", "keeper", "cliff", "storm"][i % 5], isRegex: false }] })) } });
  await store.save({ schemaVersion: sv, kind: "regex", id: "cleanup", body: { name: "Prose Cleanup", rules: [
    { id: "r1", label: "Trim stage directions", find: "\\[.*?\\]", replace: "", flags: "g", enabled: true, sortOrder: 0, phases: ["output"] },
    { id: "r2", label: "Soften dashes", find: "dash", replace: "run", flags: "g", enabled: true, sortOrder: 1, phases: ["output", "display"] },
    { id: "r3", label: "Remove OOC", find: "\\(OOC:.*?\\)", replace: "", flags: "gi", enabled: false, sortOrder: 2, phases: ["output"] },
  ] } });
  await store.save({ schemaVersion: sv, kind: "quickreply", id: "commands", body: { name: "Scene Commands", replies: Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, label: ["Continue", "Describe", "Skip ahead", "Ask", "Summarize", "Narrate"][i], message: `/send ${["go on", "describe the room", "skip ahead an hour", "what does she say?", "summarize so far", "narrate the storm"][i]}` })) } });

  const conn = await saveProvider({ kind: "local", model: "fake-model", baseURL: `http://127.0.0.1:${MODEL}/v1`, name: "Fake" }, { passphrase: "x-harness" });
  const chat = (await (await post("/api/chats/start", { characterId: "marguerite" })).json()) as { id: string };
  await post("/api/chats/connection", { chatId: chat.id, connection: { id: conn.id, model: "fake-model" } });
  let v = ((await (await post("/api/chats/send", { chatId: chat.id, content: "I took the cliff path. *I shake the rain from my hat.* \"Is the light still burning?\"", greetingIndex: 0, expectedVersion: 1 })).json()) as { branchVersion: number }).branchVersion;
  const turn = async (kind: string, extra: Record<string, unknown>) => { await (await post("/api/chats/turn", { chatId: chat.id, kind, expectedVersion: v, ...extra })).text(); };
  const open = async () => (await (await handler(new Request(`http://127.0.0.1:${PORT}/api/chats/open?id=${chat.id}`, { headers }))).json()) as { branchVersion: number; messages: { id: string }[] };
  await turn("reply", {});
  let o = await open(); v = o.branchVersion;
  await post("/api/chats/send", { chatId: chat.id, content: "Then I will stay until it is not needed.", greetingIndex: 0, expectedVersion: v });
  o = await open(); v = o.branchVersion;
  await turn("reply", {});
  o = await open(); v = o.branchVersion;
  await turn("swipe", { messageId: o.messages.at(-1)!.id });
  return { url: `http://127.0.0.1:${PORT}/`, chatId: chat.id, close: () => { server.stop(true); model.stop(true); } };
}
