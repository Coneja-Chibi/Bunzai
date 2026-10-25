/**
 * The Fallback Model on the send path (RoleCall: worker.ts post-retry fallback, fallback-model.ts): when the scene's own model
 * fails the way RoleCall calls transient and nothing was written yet, the chosen fallback answers once, through the same
 * connect. Fixtures are scene-turn.test.ts's own.
 */
import { describe, expect, test } from "bun:test";
import { ProviderError, type Provider, type ProviderCompletion } from "../stage/contracts/provider";
import type { ChatConnection } from "../stage/contracts/chat-store";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { runTurn, stopTurn, type Connected, type TurnEvent } from "./scene-turn";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};

const down = () => new ProviderError("overloaded", { category: "service_unavailable", code: "service_unavailable", status: 503 });
const refused = () => new ProviderError("bad request", { category: "api_error", code: "backend_error", status: 400 });
const ok = (text: string): ProviderCompletion => ({ content: text, finish_reason: "stop", raw: {} }) as ProviderCompletion;

/** A provider that fails (after any `pieces`) or answers, and records the models it was asked for. */
function fake(id: string, how: { fail?: ProviderError | DOMException; pieces?: string[]; answer?: string }) {
  const asked: string[] = [];
  const provider: Provider = {
    id,
    async send(request, io) {
      asked.push(request.model);
      for (const p of how.pieces ?? []) io?.onEvent?.({ channel: "content", delta: p });
      if (how.fail) throw how.fail;
      for (const p of how.answer ? [how.answer] : []) io?.onEvent?.({ channel: "content", delta: p });
      return ok(how.answer ?? "");
    },
  };
  return { provider, asked };
}

async function scene(providers: Record<string, Provider>) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const state = memoryStateStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "main", model: "vera-1" });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }]);
  const deps = {
    chats,
    state,
    connect: async (c: ChatConnection): Promise<Connected | null> => (providers[c.id] ? { provider: providers[c.id]!, kind: "openrouter", context: 32_000 } : null),
    readPreset: async () => null,
    readLorebook: async () => null,
    now: () => (now += 10),
    randomSeed: () => 7,
  };
  const events: TurnEvent[] = [];
  const turn = async (fallback?: ChatConnection) => {
    const v = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    return runTurn(deps, { chatId: chat.id, kind: "reply", expectedVersion: v, ...(fallback ? { fallback } : {}) }, (e) => events.push(e));
  };
  const texts = async () => (await chats.readMessages(chat.activeBranchId, { limit: 50 })).messages.map((m) => m.swipes[m.current]!.content);
  return { chats, chat, events, turn, texts };
}

const FB: ChatConnection = { id: "backup", model: "vera-lite" };

describe("fallback model", () => {
  test("a transient failure before any text: the fallback answers once and the take records its model", async () => {
    const main = fake("main", { fail: down() });
    const backup = fake("backup", { answer: "Calm." });
    const s = await scene({ main: main.provider, backup: backup.provider });
    await s.turn(FB);
    expect(main.asked).toEqual(["vera-1"]);
    expect(backup.asked).toEqual(["vera-lite"]);
    expect(s.events.map((e) => e.type)).toEqual(["start", "text", "done"]);
    expect(await s.texts()).toEqual(["Evening.", "Any storms?", "Calm."]);
    const reply = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 50 })).messages.at(-1)!;
    expect(reply.swipes[0]!.generation).toMatchObject({ model: "vera-lite" });
    expect(await s.chats.swipeTrace(reply.id, reply.swipes[0]!.id)).toMatchObject({ request: { model: "vera-lite" } });
  });

  test("a 5xx or 429 from the wire counts as transient; a 400 does not", async () => {
    for (const [status, retried] of [[502, true], [429, true], [400, false]] as const) {
      const main = fake("main", { fail: new ProviderError("x", { category: "api_error", code: "backend_error", status }) });
      const backup = fake("backup", { answer: "ok" });
      const s = await scene({ main: main.provider, backup: backup.provider });
      await s.turn(FB);
      expect(backup.asked.length).toBe(retried ? 1 : 0);
    }
  });

  test("a permanent failure does not switch models", async () => {
    const backup = fake("backup", { answer: "no" });
    const s = await scene({ main: fake("main", { fail: refused() }).provider, backup: backup.provider });
    await s.turn(FB);
    expect(backup.asked).toEqual([]);
    expect(s.events.at(-1)).toMatchObject({ type: "failed", code: "backend_error", message: "bad request" });
  });

  test("a stop never retries, even when the stopped call surfaces as a transient-looking error", async () => {
    const backup = fake("backup", { answer: "no" });
    const waiting: Provider = {
      id: "main",
      send: (_r, io) => new Promise((_, reject) => io?.signal?.addEventListener("abort", () => reject(down()))),
    };
    const s = await scene({ main: waiting, backup: backup.provider });
    const running = s.turn(FB);
    for (let i = 0; i < 100 && !s.events.some((e) => e.type === "start"); i++) await Bun.sleep(5);
    expect(stopTurn(s.chat.id, (s.events[0] as { turnId: string }).turnId)).toBe(true);
    await running;
    expect(backup.asked).toEqual([]);
    expect(s.events.at(-1)).toEqual({ type: "stopped", message: null });
  });

  test("a failure after text started is not switched mid-reply: the draft is handed back, nothing saved", async () => {
    const backup = fake("backup", { answer: "no" });
    const s = await scene({ main: fake("main", { pieces: ["Par"], fail: down() }).provider, backup: backup.provider });
    await s.turn(FB);
    expect(backup.asked).toEqual([]);
    expect(s.events.at(-1)).toMatchObject({ type: "failed", draft: "Par" });
    expect(await s.texts()).toEqual(["Evening.", "Any storms?"]);
  });

  test("no fallback set: the original error surfaces unchanged", async () => {
    const s = await scene({ main: fake("main", { fail: down() }).provider });
    await s.turn();
    expect(s.events.at(-1)).toEqual({ type: "failed", category: "service_unavailable", code: "service_unavailable", message: "overloaded", draft: "" });
  });

  test("a fallback equal to the main model, or one Kit no longer has, is not tried", async () => {
    const main = fake("main", { fail: down() });
    const s = await scene({ main: main.provider });
    await s.turn({ id: "main", model: "vera-1" });
    await s.turn({ id: "gone", model: "x" });
    expect(main.asked).toEqual(["vera-1", "vera-1"]);
    expect(s.events.filter((e) => e.type === "failed").map((e) => (e as { message: string }).message)).toEqual(["overloaded", "overloaded"]);
  });

  test("when the fallback fails too, the main model's error is what the person sees (RoleCall: lastGenError)", async () => {
    const backup = fake("backup", { fail: new ProviderError("backup down", { category: "api_error", code: "backend_error", status: 500 }) });
    const s = await scene({ main: fake("main", { fail: down() }).provider, backup: backup.provider });
    await s.turn(FB);
    expect(backup.asked.length).toBe(1);
    expect(s.events.at(-1)).toMatchObject({ type: "failed", message: "overloaded" });
    expect(await s.texts()).toEqual(["Evening.", "Any storms?"]);
  });
});

describe("what the stored trace says of the route and the macros (rc-parity 08, the Context wing's Route and Macros tabs)", () => {
  const traceOfLast = async (s: Awaited<ReturnType<typeof scene>>) => {
    const reply = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 50 })).messages.at(-1)!;
    return (await s.chats.swipeTrace(reply.id, reply.swipes[0]!.id)) as Record<string, any>;
  };

  test("a reply on the scene's own model records one attempt that answered", async () => {
    const s = await scene({ main: fake("main", { answer: "Calm." }).provider });
    await s.turn();
    expect((await traceOfLast(s))["route"]).toEqual({ attempts: [{ connectionId: "main", kind: "openrouter", model: "vera-1", outcome: "answered" }] });
  });

  test("a fallback records the attempt that failed, with why, and the one that answered", async () => {
    const s = await scene({ main: fake("main", { fail: down() }).provider, backup: fake("backup", { answer: "Calm." }).provider });
    await s.turn(FB);
    expect((await traceOfLast(s))["route"]).toEqual({
      attempts: [
        { connectionId: "main", kind: "openrouter", model: "vera-1", outcome: "failed", status: 503, code: "service_unavailable", message: "overloaded" },
        { connectionId: "backup", kind: "openrouter", model: "vera-lite", outcome: "answered" },
      ],
    });
  });

  test("the macros the request used and the variables it changed are in the trace, with what each was before", async () => {
    const s = await scene({ main: fake("main", { answer: "Calm." }).provider });
    await s.chats.appendMessages(s.chat.activeBranchId, [{ role: "user", content: "{{setvar::mood::wary}}{{char}}, any storms?" }]);
    await s.turn();
    const trace = await traceOfLast(s);
    expect(trace["macros"].used.find((m: { name: string }) => m.name === "char")).toMatchObject({ count: 1, value: "Vera" });
    expect(trace["macros"].mutations).toEqual([{ scope: "local", key: "mood", value: "wary", cause: "setvar" }]);
    expect(trace["variables"]).toEqual([{ scope: "local", key: "mood", after: "wary" }]);
  });
});
