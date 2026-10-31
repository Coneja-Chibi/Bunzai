/** New scenes may use rp-core as the turn engine while Bunzai keeps its scene projection. */
import { Engine, createOpenAIChatProvider, resolveCaps } from "rp-core";
import type { Character, Connection, Persona } from "rp-core";
import type { AsyncSessionHandle } from "rp-core";
import { bodyOf } from "../core/guards";
import type { ChatConnection, ChatStore } from "../stage/contracts/chat-store";
import type { CoreSceneRecords } from "../stage/store/sqlite/core-record-store";
import { allowedHost, guardedFetch } from "../kit/providers/egress";
import { coreOllamaProvider } from "./core-ollama-provider";
import { spokes } from "../kit/providers/registry";
import { readVault } from "../kit/providers/vault";
import { StudioValidationError } from "./errors";
import { StudioConflictError } from "./errors";

const text = (value: unknown): string => typeof value === "string" ? value : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function coreCharacter(source: unknown): Character {
  const body = bodyOf(source);
  const identity = record(body["identity"]);
  const persona = record(body["persona"]);
  const prompts = record(body["prompts"]);
  const greetings = record(body["greetings"]);
  const examples = record(body["examples"]);
  return {
    name: text(identity["name"]), description: text(identity["description"]),
    ...(text(persona["personality"]) ? { personality: text(persona["personality"]) } : {}),
    ...(text(persona["scenario"]) ? { scenario: text(persona["scenario"]) } : {}),
    greetings: [text(greetings["firstMessage"]), ...((Array.isArray(greetings["alternateGreetings"]) ? greetings["alternateGreetings"] : []).map((g) => text(record(g)["text"])))].filter(Boolean),
    ...(text(examples["exampleMessages"]) ? { examples: text(examples["exampleMessages"]) } : {}),
    ...(text(prompts["systemPrompt"]) ? { systemPrompt: text(prompts["systemPrompt"]) } : {}),
    ...(text(prompts["postHistoryInstructions"]) ? { postHistory: text(prompts["postHistoryInstructions"]) } : {}),
  };
}

function corePersona(source: unknown): Persona {
  const body = bodyOf(source);
  return { name: text(body["name"]), description: text(body["content"]) };
}

/** Uses the same pinned host and saved secret as Kit; this first route is OpenAI-chat compatible. */
async function connectionFor(pick: ChatConnection): Promise<{ connection: Connection; fetch: typeof fetch }> {
  const saved = (await readVault()).providers.find((provider) => provider.id === pick.id);
  if (!saved) throw new StudioValidationError("the scene's Kit connection is gone");
  const catalog = await spokes();
  const spoke = catalog.get(saved.kind);
  if (!spoke?.scene) throw new StudioValidationError("this Kit connection cannot drive a scene");
  if (spoke.scene.native || (spoke.scene.resolve && saved.kind !== "ollama")) throw new StudioValidationError("this provider needs a native rp-core adapter");
  const baseUrl = spoke.scene.base({ ...saved, model: pick.model });
  if (!baseUrl) throw new StudioValidationError("this connection needs a base URL");
  const host = allowedHost(saved, spoke);
  if (new URL(baseUrl).host !== host) throw new StudioValidationError("the connection's host changed");
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/.test(new URL(baseUrl).host);
  const origin = new URL(baseUrl).origin;
  const caps = resolveCaps({ dialect: "openai-chat", origin, local, model: pick.model, server: saved.kind, ...(saved.context ? { user: { contextLength: saved.context } } : {}) });
  if (saved.kind === "ollama" && spoke.scene.resolve) {
    const config = { ...saved, model: pick.model };
    const { provider: native, traits } = await spoke.scene.resolve(config, guardedFetch(host), saved.name ?? "Ollama");
    const ollamaCaps = {
      ...caps,
      ...(traits?.window ? { contextLength: traits.window } : {}),
      tools: traits?.tools ? "native" as const : "none" as const,
      midSystem: "native" as const,
      alternation: "free" as const,
      streamUsage: "always" as const,
      samplers: { ...caps.samplers, accepted: Array.from(new Set([...caps.samplers.accepted, "top_k", "min_p", "typical_p", "repetition_penalty"])) },
    };
    return { connection: { id: pick.id, provider: coreOllamaProvider(native), caps: ollamaCaps, origin, local, key: null }, fetch: guardedFetch(host) };
  }
  return {
    connection: { id: pick.id, provider: createOpenAIChatProvider({ connectionId: pick.id, baseUrl, local }), caps, origin, local, key: saved.apiKey ?? null },
    fetch: guardedFetch(host),
  };
}

export async function createCoreSceneSession(chats: ChatStore, records: CoreSceneRecords, home: string, chatId: string): Promise<void> {
  const snapshot = await chats.castSnapshot(chatId);
  const chat = await chats.getChat(chatId);
  if (!snapshot || !chat) throw new StudioValidationError("the new scene is gone");
  const engine = await Engine.openWithRecordStore({ home, recordStore: records, lane: "manual" });
  try {
    const session = await engine.createSession({ character: coreCharacter(snapshot.character), ...(snapshot.persona ? { persona: corePersona(snapshot.persona) } : {}), title: chat.title });
    await records.link(chatId, session.id, chat.activeBranchId);
  } finally { await engine.close(); }
}

export async function openCoreScene(records: CoreSceneRecords, home: string, sessionId: string, pick: ChatConnection) {
  const { connection, fetch } = await connectionFor(pick);
  const engine = await Engine.openWithRecordStore({ home, recordStore: records, connections: { [connection.id]: connection }, fetch, lane: "manual" });
  try {
    const session = await engine.session(sessionId);
    await session.configure({ roles: { narrator: { conn: connection.id, model: pick.model } } });
    return { engine, session };
  } catch (error) { await engine.close(); throw error; }
}

/** Refuse a stale projection before a new turn can write from the wrong history. */
export async function checkCoreProjection(chats: ChatStore, chatId: string, session: AsyncSessionHandle): Promise<void> {
  const chat = await chats.getChat(chatId);
  if (!chat) throw new StudioConflictError("the scene is gone");
  const path = (await session.view()).path;
  const count = await chats.countMessages(chat.activeBranchId);
  // rp-core opens on its first greeting; Bunzai shows that greeting after the first send.
  if (count === 0 && path.length === 1 && path[0]?.role === "assistant") return;
  if (count !== path.length) throw new StudioConflictError("the rp-core journal and scene differ; export this scene before continuing");
  if (path.length === 0) return;
  const last = (await chats.readMessagesBefore(chat.activeBranchId, { limit: 1, liveOnly: true })).messages.at(-1);
  const head = path.at(-1)!;
  const text = head.blocks.filter((block) => block.k === "text").map((block) => block.text).join("");
  if (!last || last.role !== head.role || last.swipes[0]?.content !== text) throw new StudioConflictError("the rp-core journal and scene differ; export this scene before continuing");
}

export async function sendCoreScene(chats: ChatStore, chatId: string, records: CoreSceneRecords, home: string, sessionId: string, content: string, greetingIndex: number): Promise<void> {
  const engine = await Engine.openWithRecordStore({ home, recordStore: records, lane: "manual" });
  try {
    const session = await engine.session(sessionId);
    await checkCoreProjection(chats, chatId, session);
    const chat = await chats.getChat(chatId);
    const first = chat !== null && await chats.countMessages(chat.activeBranchId) === 0;
    await session.send({ text: content, expectedVersion: await session.version(), ...(first && (await session.view()).path.length > 0 ? { greetingIndex } : {}) });
  } finally { await engine.close(); }
}

/** Rebuilds a missing ChatStore tail after a crash between core commit and UI projection. */
export async function reconcileCoreScene(chats: ChatStore, chatId: string, branchId: string, records: CoreSceneRecords, home: string, sessionId: string): Promise<void> {
  const chat = await chats.getChat(chatId);
  if (!chat || chat.activeBranchId !== branchId) return;
  const engine = await Engine.openWithRecordStore({ home, recordStore: records, lane: "manual" });
  try {
    const session = await engine.session(sessionId);
    const path = (await session.view()).path;
    const count = await chats.countMessages(branchId);
    // An untouched core session has a greeting; Bunzai waits to show it until first send.
    if (count === 0 && path.length === 1 && path[0]?.role === "assistant") return;
    if (count > path.length) throw new StudioConflictError("the scene is ahead of its rp-core journal");
    if (count > 0) {
      const last = (await chats.readMessagesBefore(branchId, { limit: 1, liveOnly: true })).messages.at(-1);
      const head = path[count - 1];
      if (!last || !head || last.role !== head.role) throw new StudioConflictError("the scene and rp-core journal differ");
      const content = head.blocks.filter((block) => block.k === "text").map((block) => block.text).join("");
      if (last.swipes[0]?.content !== content) {
        if (count !== path.length || head.role !== "assistant") throw new StudioConflictError("the scene and rp-core journal differ");
        const full = (await chats.readMessages(branchId, { fromSeq: last.seq, limit: 1 })).messages[0];
        if (!full) throw new StudioConflictError("the scene and rp-core journal differ");
        if (head.swipe.count > full.swipes.length) await chats.addSwipe(full.id, { content });
        else if (head.edited) await chats.editSwipe(full.id, full.swipes[full.current]!.id, content);
        else throw new StudioConflictError("the scene and rp-core journal differ");
      }
    }
    for (const message of path.slice(count)) {
      const content = message.blocks.filter((block) => block.k === "text").map((block) => block.text).join("");
      await chats.appendMessage(branchId, { role: message.role, content, ...(message.gen?.model ? { generation: { model: message.gen.model } } : {}) });
    }
  } catch (error) {
    // A live turn owns the journal. The saved scene can still open, and the next open
    // will reconcile it after the turn releases its lease.
    if (!(error instanceof Error && error.message === "rp-core session locked")) throw error;
  } finally { await engine.close(); }
}
