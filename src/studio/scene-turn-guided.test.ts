/**
 * Guided re-roll on the turn loop (rc-parity 03 slice 5): guidance rides only on a swipe, the rejected
 * draft and RoleCall's directive go in before any prefill, and the new version's generation record keeps
 * the guidance so the bubble can offer "Edit guided re-roll". Fixtures are scene-turn-preset.test.ts's own.
 */
import { describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import type { PresetBody, PresetPrompt } from "../entities/preset/schema";
import { buildGuidedSwipeDirective } from "../core/assembly/guided-swipe";
import type { Message } from "../stage/contracts/chat-store";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { StudioValidationError } from "./errors";
import { runTurn, type Connected, type TurnEvent } from "./scene-turn";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};
const block = (id: string, content: string): PresetPrompt => ({
  id, name: id, content, role: "system", enabled: true, systemPrompt: true, marker: false,
  placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false,
});
const quill: PresetBody = {
  name: "Velvet Quill",
  prompts: [block("main", "Write as {{char}}."), block("history", "{{message_history}}")],
  samplers: { temperature: 1, topP: 0.9, maxTokens: 600, promptPostProcessing: "merge" },
  systemPrompts: { assistantPrefill: "{{char}}:" },
};

/** A scene whose take ends on a reply ("Maybe.") to "Any storms?", answered by a provider that says "Colder." each time. */
async function scene(opts: { preset?: boolean; model?: string } = {}) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: opts.model ?? "vera-1" });
  if (opts.preset) await chats.setPreset(chat.id, { kind: "preset", id: "quill", toggles: {}, samplers: {} });
  const [, , reply] = (await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }, { role: "assistant", content: "Maybe." }]))!;
  const sent: ProviderRequest[] = [];
  const provider: Provider = {
    id: "fake",
    async send(request) {
      sent.push(request);
      return { content: "Colder.", finish_reason: "stop", raw: {} } as ProviderCompletion;
    },
  };
  const deps = { runtime: createTurnRuntime(),
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }),
    readPreset: async () => quill, readLorebook: async () => null,
    now: () => (now += 10), randomSeed: () => 7,
  };
  const events: TurnEvent[] = [];
  const swipe = async (guidance?: string) => {
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    return runTurn(deps, { chatId: chat.id, kind: "swipe", expectedVersion: version, ...(guidance === undefined ? {} : { guidance }) }, (e) => events.push(e));
  };
  const messages = async () => (await chats.readMessages(chat.activeBranchId, { limit: 20 })).messages;
  return { chats, chat, reply: reply!, sent, events, swipe, deps, messages };
}

const swipeIdOf = (messages: Message[]): string => { const m = messages[2]!; return m.swipes[m.current]!.id; };
const tail = (r: ProviderRequest, n: number) => r.messages.slice(-n).map((m) => `${m.role}:${m.content}`);

describe("a guided swipe", () => {
  test("sends the rejected draft as an assistant message, then RoleCall's directive as a system message, at the end of the request", async () => {
    const s = await scene();
    await s.swipe("Make her colder.");
    expect(tail(s.sent[0]!, 3)).toEqual([
      "user:Any storms?",
      "assistant:[REJECTED DRAFT - NOT PART OF THE STORY]\nMaybe.",
      `system:${buildGuidedSwipeDirective("Make her colder.")}`,
    ]);
  });

  test("the preset's prefill still comes last, after the directive", async () => {
    const s = await scene({ preset: true });
    await s.swipe("Make her colder.");
    const out = s.sent[0]!.messages;
    expect(out.at(-1)).toEqual({ role: "assistant", content: "Vera:" });
    expect(out.at(-2)).toEqual({ role: "system", content: buildGuidedSwipeDirective("Make her colder.") });
    expect(out.at(-3)).toEqual({ role: "assistant", content: "[REJECTED DRAFT - NOT PART OF THE STORY]\nMaybe." });
  });

  test("the rejected draft is the version the take is showing", async () => {
    const s = await scene();
    await s.chats.addSwipe(s.reply.id, { content: "Perhaps." });
    await s.swipe("Shorter.");
    expect(s.sent[0]!.messages.at(-2)!.content).toBe("[REJECTED DRAFT - NOT PART OF THE STORY]\nPerhaps.");
  });

  test("the new version is a new version, and its generation record keeps the guidance", async () => {
    const s = await scene();
    await s.swipe("  Make her colder.  ");
    const [, , reply] = await s.messages();
    expect(reply!.swipes.map((w) => w.content)).toEqual(["Maybe.", "Colder."]);
    expect(reply!.swipes[1]!.generation).toMatchObject({ guidance: "Make her colder." });
    expect(reply!.swipes[0]!.generation?.guidance).toBeUndefined();
  });

  test("no guidance, or blank guidance, is a plain re-roll: the same request and no guidance on the record", async () => {
    const plain = await scene();
    await plain.swipe();
    for (const blank of ["", "   \n"]) {
      const s = await scene();
      await s.swipe(blank);
      expect(s.sent[0]!.messages).toEqual(plain.sent[0]!.messages);
      expect((await s.messages())[2]!.swipes[1]!.generation).not.toHaveProperty("guidance");
    }
  });

  test("guidance is the swipe's alone: a reply or a continue refuses it before anything opens", async () => {
    for (const kind of ["reply", "continue"] as const) {
      const s = await scene();
      const version = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion!;
      const error = await runTurn(s.deps, { chatId: s.chat.id, kind, expectedVersion: version, guidance: "Make her colder." }, (e) => s.events.push(e)).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(StudioValidationError);
      expect(s.sent).toHaveLength(0);
      expect(s.events).toHaveLength(0);
      expect(await s.chats.resumeIncomplete()).toHaveLength(0);
    }
  });

  test("guidance past the Scene Note's 10,000 characters is refused before anything opens", async () => {
    const s = await scene();
    const error = await s.swipe("x".repeat(10_001)).then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(StudioValidationError);
    expect(s.sent).toHaveLength(0);
  });

  test("the stored request and trace hold the rejected draft and the directive as their own blocks, in send order, after the assembled ones", async () => {
    const s = await scene();
    await s.swipe("Make her colder.");
    const sentTexts = s.sent[0]!.messages.map((m) => m.content);
    const request = await s.chats.lastRequest(s.chat.activeBranchId);
    expect(request!.texts).toEqual(sentTexts);
    const trace = await s.chats.swipeTrace(s.reply.id, swipeIdOf(await s.messages()));
    const blocks = (trace!["blocks"] as { source: { kind: string }; role: string; tokens: number }[]);
    expect(blocks).toHaveLength(request!.texts.length);
    expect(blocks.slice(-2).map((b) => [b.source.kind, b.role])).toEqual([["guided-draft", "assistant"], ["guided-directive", "system"]]);
    expect(blocks.slice(-2).every((b) => b.tokens > 0)).toBe(true);
  });

  test("a plain swipe's stored request has no guided blocks", async () => {
    const s = await scene();
    await s.swipe();
    const trace = await s.chats.swipeTrace(s.reply.id, swipeIdOf(await s.messages()));
    expect(JSON.stringify(trace!["blocks"])).not.toContain("guided");
  });
});
