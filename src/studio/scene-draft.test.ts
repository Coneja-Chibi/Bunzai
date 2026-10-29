/**
 * The draft tools (studio/scene-draft.ts): one non-committing generation behind Expand as character, Polish
 * Input and the Correction Tools. The risk is a draft that writes: no message, no version, no variable, no
 * checkpoint, no meter sample may change. The prompts are RoleCall's, with the perspective line and the
 * player's-draft framing as the two named deviations.
 */
import { describe, expect, test } from "bun:test";
import type { PresetBody, PresetPrompt } from "../entities/preset/schema";
import { ProviderError, type Provider, type ProviderCompletion, type ProviderRequest } from "../stage/contracts/provider";
import type { ChatStore } from "../stage/contracts/chat-store";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { saveGuide } from "./guides";
import { runDraft, type DraftInput } from "./scene-draft";
import { NoConnectionError, type Connected } from "./scene-turn";
import { StudioNotFoundError } from "./errors";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};
const mira = { kind: "persona", id: "mira", body: { name: "Mira", content: "A surveyor." } };
const block = (id: string, content: string): PresetPrompt => ({
  id, name: id, content, role: "system", enabled: true, systemPrompt: true, marker: false,
  placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false,
});
const quill = (over: Partial<PresetBody> = {}): PresetBody => ({
  name: "Quill",
  prompts: [block("main", "Write as {{char}}."), block("history", "{{message_history}}")],
  samplers: { temperature: 0.9, topP: 0.8, maxTokens: 6000 },
  systemPrompts: { assistantPrefill: "Vera:" },
  ...over,
});

/** A draft request without its scene, which the rig fills in. */
type DraftBody = DraftInput extends infer U ? (U extends unknown ? Omit<U, "chatId"> : never) : never;

/** Anything the draft calls on the store beyond reading is a write; the proxy records every method name. */
function spied(chats: ChatStore): { chats: ChatStore; calls: string[] } {
  const calls: string[] = [];
  const proxy = new Proxy(chats, { get: (target, key) => { calls.push(String(key)); return Reflect.get(target, key); } });
  return { chats: proxy, calls };
}
const READS = new Set(["getChat", "lightCastSnapshot", "readMessages", "sceneState", "sceneStateBefore", "swipeTrace", "globalOps", "then"]);

async function scene(over: { preset?: PresetBody; reply?: string; fail?: Error; connected?: boolean; persona?: boolean } = {}) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const state = memoryStateStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 }, ...(over.persona === false ? {} : { persona: { id: "mira", version: 1 } }) }, snapshot: { character: vera, ...(over.persona === false ? {} : { persona: mira }) } });
  if (over.connected !== false) await chats.setConnection(chat.id, { id: "conn", model: "scene-model" });
  if (over.preset) await chats.setPreset(chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: {} });
  await chats.appendMessages(chat.activeBranchId, [
    { role: "assistant", content: "Evening." },
    { role: "user", content: "{{setvar::asked::yes}}Any storms?" },
    { role: "assistant", content: "{{user}} should hurry." },
  ]);
  const sent: ProviderRequest[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  const provider: Provider = {
    id: "fake",
    async send(request, io) {
      sent.push(request);
      signals.push(io?.signal);
      if (over.fail) throw over.fail;
      return { content: over.reply ?? "I step into the rain.", finish_reason: "stop", raw: {} } as ProviderCompletion;
    },
  };
  const watch = spied(chats);
  const deps = {
    chats: watch.chats,
    state,
    connect: async (): Promise<Connected | null> => (over.connected === false ? null : { provider, kind: "openrouter", context: 32_000 }),
    readPreset: async () => over.preset ?? null,
    readLorebook: async () => null,
    now: () => (now += 10),
    randomSeed: () => 7,
  };
  const branch = chat.activeBranchId;
  /** Everything the take holds that a draft must leave alone. */
  const snapshot = async () => JSON.stringify({ page: await chats.readMessages(branch, { limit: 50 }), vars: await chats.sceneState(branch), resume: await chats.resumeIncomplete(), meter: await state.read("meter"), globals: await state.read("variables") });
  const draft = (input: DraftBody, signal?: AbortSignal) => runDraft(deps, { chatId: chat.id, ...input } as DraftInput, signal);
  return { chats, state, chat, sent, signals, draft, snapshot, calls: watch.calls, deps };
}

describe("Expand as character", () => {
  test("answers text and changes nothing in the take: no message, version, variable, checkpoint or meter sample", async () => {
    const s = await scene();
    const before = await s.snapshot();
    s.calls.length = 0;
    expect(await s.draft({ kind: "impersonate", brief: "ask about storms" })).toEqual({ text: "I step into the rain." });
    expect(s.calls.filter((c) => !READS.has(c))).toEqual([]);
    expect(await s.snapshot()).toBe(before);
  });

  test("the history ends on the take as it stands, then one final system message: the default prompt, the perspective, the hint", async () => {
    const s = await scene();
    await s.draft({ kind: "impersonate", brief: "ask about storms", perspective: "2nd" });
    const [request] = s.sent;
    expect(request!.model).toBe("scene-model");
    const roles = request!.messages.map((m) => m.role);
    expect(roles.slice(-4)).toEqual(["assistant", "user", "assistant", "system"]);
    expect(request!.messages.at(-1)!.content).toBe(
      "[Write your next reply from the point of view of Mira, using the chat history so far as a guideline for the writing style of Mira. Don't write as Vera or system. Don't describe actions of Vera.]\n\n" +
        "Write in second person (you).\n\n" +
        "Hint for this reply (treat as the user's intent, expand into a full message in their voice — do NOT echo this verbatim):\nask about storms", // emdash-ok: RoleCall's exact text
    );
  });

  test("the perspective defaults to the 1st person line, and each pill adds only its own line", async () => {
    const s = await scene();
    await s.draft({ kind: "impersonate", brief: "" });
    await s.draft({ kind: "impersonate", brief: "", perspective: "3rd" });
    const last = (i: number) => s.sent[i]!.messages.at(-1)!.content;
    expect(last(0).endsWith("\n\nWrite in first person (I, we).")).toBe(true);
    expect(last(1).endsWith("\n\nWrite in third person, by name.")).toBe(true);
    expect(last(0)).not.toContain("Hint for this reply");
  });

  test("the preset's impersonation prompt replaces the default, and the perspective line follows it", async () => {
    const s = await scene({ preset: quill({ systemPrompts: { impersonation: "Speak as {{user}} now.", assistantPrefill: "Vera:" } }) });
    await s.draft({ kind: "impersonate", brief: "x", perspective: "1st" });
    expect(s.sent[0]!.messages.find((m) => m.content.startsWith("Speak as"))!.content).toBe("Speak as Mira now.\n\nWrite in first person (I, we).\n\nHint for this reply (treat as the user's intent, expand into a full message in their voice — do NOT echo this verbatim):\nx"); // emdash-ok: RoleCall's exact text
  });

  test("the prefill is the preset's impersonation prefill and never its character-voice prefill", async () => {
    const both = await scene({ preset: quill({ systemPrompts: { assistantPrefill: "Vera:", assistantImpersonation: "Mira:" } }) });
    await both.draft({ kind: "impersonate", brief: "" });
    expect(both.sent[0]!.messages.at(-1)).toEqual({ role: "assistant", content: "Mira:" });
    const plain = await scene({ preset: quill() });
    await plain.draft({ kind: "impersonate", brief: "" });
    expect(plain.sent[0]!.messages.some((m) => m.content.includes("Vera:"))).toBe(false);
    expect(plain.sent[0]!.messages.at(-1)!.role).toBe("system");
  });

  test("the request is not streamed, uses the preset's samplers, and caps only the reply length to a draft's size", async () => {
    const s = await scene({ preset: quill() });
    await s.draft({ kind: "impersonate", brief: "" });
    expect(s.sent[0]!.options).toMatchObject({ temperature: 0.9, top_p: 0.8, max_tokens: 2000 });
    expect(s.sent[0]!.options.stream).toBeUndefined();
    const small = await scene({ preset: quill({ samplers: { temperature: 0.4, maxTokens: 300 } }) });
    await small.draft({ kind: "impersonate", brief: "" });
    expect(small.sent[0]!.options).toMatchObject({ temperature: 0.4, max_tokens: 300 });
  });

  test("the reply has its reasoning cut away and its ends trimmed; a reply of nothing is an error, never an empty success", async () => {
    const s = await scene({ reply: "<think>plan</think>\n  I wave.  " });
    expect(await s.draft({ kind: "impersonate", brief: "" })).toEqual({ text: "I wave." });
    const empty = await scene({ reply: "   " });
    const error = await empty.draft({ kind: "impersonate", brief: "" }).then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
  });
});

describe("Polish Input and the editors", () => {
  test("Polish frames the text as the player's draft, names the persona, and keeps the minimal-change rule", async () => {
    const s = await scene();
    expect(await s.draft({ kind: "polish", text: "i walks in" })).toEqual({ text: "I step into the rain." });
    const [request] = s.sent;
    expect(request!.messages).toHaveLength(2);
    const system = request!.messages[0]!.content;
    expect(system).toContain("The message is the player's own draft, written as Mira. It is not the character's.");
    expect(system).toContain("Maintaining the player's voice and writing style");
    expect(system).toContain("IMPORTANT: Make MINIMAL changes.");
    expect(system).not.toContain("Character: Vera");
    expect(request!.messages[1]).toEqual({ role: "user", content: "Original message:\n\ni walks in\n\nPolished message:" });
    expect(request!.options).toMatchObject({ temperature: 0.2, max_tokens: 2000 });
  });

  test("Spellcheck on a reply keeps RoleCall's character framing", async () => {
    const s = await scene();
    await s.draft({ kind: "spellcheck", text: "She wlaks." });
    expect(s.sent[0]!.messages[0]!.content).toContain("Character: Vera");
    expect(s.sent[0]!.messages[0]!.content).toContain("Maintaining the character's voice and writing style");
  });

  test("Correct sends a correction guide's text; a guide that is not a correction, or is gone, is refused before anything is sent", async () => {
    const s = await scene();
    const good = await saveGuide(s.state, { title: "Tense", content: "Use past tense.", type: "correction" }, 1, () => "g-good");
    const plain = await saveGuide(s.state, { title: "Plain", content: "Be brief.", type: "guide" }, 2, () => "g-plain");
    await s.draft({ kind: "correct", text: "She walks.", guideId: good.id });
    expect(s.sent[0]!.messages[0]!.content).toContain("Correction Guidelines:\nUse past tense.");
    expect(s.sent[0]!.messages[1]!.content).toBe("Original message:\n\nShe walks.\n\nCorrected message:");
    expect(s.sent[0]!.options).toMatchObject({ temperature: 0.3, max_tokens: 2000 });
    for (const guideId of [plain.id, "nope"]) {
      const error = await s.draft({ kind: "correct", text: "x", guideId }).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(StudioNotFoundError);
    }
    expect(s.sent).toHaveLength(1);
  });

  test("Rewrite sends the whole message as context and only the selection to replace, and returns a cleaned replacement", async () => {
    const s = await scene({ reply: "```\nShe strode.\n```" });
    expect(await s.draft({ kind: "rewrite", text: "She walked quickly.", selected: "walked quickly", action: "expand" })).toEqual({ text: "She strode." });
    expect(s.sent[0]!.messages[0]!.content).toContain("Expand the selected passage");
    expect(s.sent[0]!.messages[1]!.content).toBe("Full message for context:\n\nShe walked quickly.\n\nSelected passage:\n\nwalked quickly\n\nReplacement passage:");
    expect(s.sent[0]!.options).toMatchObject({ temperature: 0.4, max_tokens: 300 });
  });

  test("an editor tool changes nothing in the take either", async () => {
    const s = await scene();
    const before = await s.snapshot();
    s.calls.length = 0;
    await s.draft({ kind: "polish", text: "hi" });
    expect(s.calls.filter((c) => !READS.has(c))).toEqual([]);
    expect(await s.snapshot()).toBe(before);
  });
});

describe("refusals", () => {
  test("a scene with no connection, a connection gone from Kit, and a scene that does not exist are refused before anything is sent", async () => {
    const none = await scene({ connected: false });
    expect(await none.draft({ kind: "polish", text: "x" }).then(() => null, (e: unknown) => e)).toBeInstanceOf(NoConnectionError);
    const gone = await scene();
    const missing = await runDraft(gone.deps, { chatId: "nope", kind: "polish", text: "x" }).then(() => null, (e: unknown) => e);
    expect(missing).toBeInstanceOf(StudioNotFoundError);
    const lost = await runDraft({ ...gone.deps, connect: async () => null }, { chatId: gone.chat.id, kind: "polish", text: "x" }).then(() => null, (e: unknown) => e);
    expect(lost).toBeInstanceOf(NoConnectionError);
  });

  test("a provider failure reaches the caller as the same ProviderError a turn would report", async () => {
    const fail = new ProviderError("bad key", { category: "invalid_request_error", code: "invalid_api_key", status: 401 });
    const s = await scene({ fail });
    expect(await s.draft({ kind: "impersonate", brief: "" }).then(() => null, (e: unknown) => e)).toBe(fail);
  });

  test("the caller's signal reaches the provider", async () => {
    const s = await scene();
    const controller = new AbortController();
    await s.draft({ kind: "polish", text: "x" }, controller.signal);
    expect(s.signals[0]).toBe(controller.signal);
  });
});

describe("the editing tools honor the scene's per-tool settings (Final Cut, ChatStore rule 44)", () => {
  /** A draft where `connect` records which connection it was asked for. */
  async function withTools(tools: NonNullable<Parameters<ChatStore["setFinalCut"]>[1]["tools"]>) {
    const s = await scene();
    await s.chats.setFinalCut(s.chat.id, { tools });
    const asked: { id: string; model: string }[] = [];
    const deps = { ...s.deps, connect: async (c: { id: string; model: string }) => { asked.push(c); return s.deps.connect(); } };
    return { s, asked, run: (input: DraftBody) => runDraft(deps, { chatId: s.chat.id, ...input } as DraftInput) };
  }

  test("Correction takes its tool's model, temperature and reply limit", async () => {
    const { s, asked, run } = await withTools({ correct: { connection: { id: "alt", model: "alt-model" }, temperature: 0.7, maxTokens: 900 } });
    const guide = await saveGuide(s.state, { title: "Past tense", content: "Use past tense.", type: "correction" }, 1, () => "g1");
    await run({ kind: "correct", text: "She walks.", guideId: guide.id });
    expect(asked.at(-1)).toEqual({ id: "alt", model: "alt-model" });
    expect(s.sent[0]!.model).toBe("alt-model");
    expect(s.sent[0]!.options).toMatchObject({ temperature: 0.7, max_tokens: 900 });
  });

  test("a Rewrite action uses its own tool: Reduce does not read Rewrite's settings", async () => {
    const { s, run } = await withTools({ rewrite: { temperature: 1.1 }, reduce: { temperature: 0.2, maxTokens: 500 } });
    await run({ kind: "rewrite", text: "She walked home slowly.", selected: "slowly", action: "reduce" });
    await run({ kind: "rewrite", text: "She walked home slowly.", selected: "slowly", action: "rewrite" });
    expect(s.sent[0]!.options).toMatchObject({ temperature: 0.2, max_tokens: 500 });
    expect(s.sent[1]!.options).toMatchObject({ temperature: 1.1 });
    expect(s.sent[1]!.model).toBe("scene-model");
  });

  test("Spellcheck, Polish and Expand as character stay on the scene's model and RoleCall's fixed numbers", async () => {
    const { s, asked, run } = await withTools({ correct: { connection: { id: "alt", model: "alt-model" }, temperature: 0.9 }, rewrite: { temperature: 1.4 } });
    await run({ kind: "spellcheck", text: "teh cat" });
    await run({ kind: "polish", text: "teh cat" });
    expect(asked.every((c) => c.id === "conn")).toBe(true);
    expect(s.sent.every((r) => r.model === "scene-model")).toBe(true);
    expect(s.sent[0]!.options.temperature).not.toBe(0.9);
    expect(s.sent[0]!.options.temperature).not.toBe(1.4);
  });

  test("a tool whose model Kit no longer has says so and runs nothing", async () => {
    const { s, run } = await withTools({ rewrite: { connection: { id: "gone", model: "m" } } });
    const missing = { ...s.deps, connect: async (c: { id: string; model: string }) => (c.id === "gone" ? null : s.deps.connect()) };
    await expect(runDraft(missing, { chatId: s.chat.id, kind: "rewrite", text: "a b", selected: "a", action: "rewrite" } as DraftInput)).rejects.toThrow("that tool's connection is gone from Kit");
    expect(s.sent).toHaveLength(0);
    void run;
  });
});

describe("the Custom tool", () => {
  test("a Custom rewrite reads the Custom tool's settings, not Rewrite's", async () => {
    const s = await scene();
    await s.chats.setFinalCut(s.chat.id, { tools: { custom: { temperature: 0.9, maxTokens: 700 }, rewrite: { temperature: 0.1 } } });
    await s.draft({ kind: "rewrite", text: "She walked home slowly.", selected: "slowly", action: "custom", instruction: "Make it sharper." });
    expect(s.sent[0]!.options).toMatchObject({ temperature: 0.9, max_tokens: 700 });
    expect(JSON.stringify(s.sent[0]!.messages)).toContain("Make it sharper.");
  });
});
