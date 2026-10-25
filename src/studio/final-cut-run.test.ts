/**
 * The Final Cut pipeline against a stand-in provider (RoleCall's service tests, ported): both answer shapes, the one retry and what it
 * changes, the reflection retry, the failure modes, the protected blocks, a Stop and the budget, and which model each pass is sent to.
 */
import { describe, expect, test } from "bun:test";
import { createPass, type FinalCutPass } from "../core/final-cut/pass";
import { ProviderError, type ProviderCompletion, type ProviderRequest } from "../stage/contracts/provider";
import { FinalCutBlocked, runFinalCut } from "./final-cut-run";
import type { Connected } from "./scene-turn";

type Answer = Partial<ProviderCompletion> | Error | ((req: ProviderRequest) => Partial<ProviderCompletion> | Error);
const call = (name: string, args: unknown) => ({ id: "c1", type: "function" as const, function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) } });
const toolAnswer = (name: string, args: Record<string, unknown>): Partial<ProviderCompletion> => ({ content: "", tool_calls: [call(name, args)], finish_reason: "tool_calls" });
const edited = (refined: string, extra: Record<string, unknown> = {}) => toolAnswer("submit_edited_message", { refined, changelog: [{ rule: "POV", description: "fixed" }], no_changes_needed: false, rule_review: null, ...extra });

function rig(answers: Answer[], tools = true) {
  const sent: ProviderRequest[] = [];
  const opened: string[] = [];
  let n = 0;
  const provider = {
    id: "fake",
    async send(req: ProviderRequest, io?: { signal?: AbortSignal }): Promise<ProviderCompletion> {
      sent.push(req);
      if (io?.signal?.aborted) throw io.signal.reason;
      const a = answers[Math.min(n++, answers.length - 1)]!;
      const r = typeof a === "function" ? a(req) : a;
      if (r instanceof Error) throw r;
      return { content: "", raw: {}, ...r } as ProviderCompletion;
    },
  };
  const env = {
    open: async (c: { id: string; model: string }): Promise<Connected | null> => { opened.push(`${c.id}/${c.model}`); return { provider, kind: "fake", tools } as unknown as Connected; },
    scene: { id: "kit1", model: "scene-model" },
    context: { characterName: "Vera", recentMessages: [{ role: "user", content: "hi" }] },
    rulebook: [],
    userBanks: {},
    now: () => 1_000,
  };
  return { sent, opened, env };
}
const editor = (extra: Partial<FinalCutPass> = {}): FinalCutPass => ({ ...createPass("editor"), ...extra });
const run = (text: string, passes: FinalCutPass[], r: ReturnType<typeof rig>, signal = new AbortController().signal, budgetMs?: number) => runFinalCut({ text, passes, env: r.env, signal, ...(budgetMs ? { budgetMs } : {}) });

describe("a model pass", () => {
  test("applies a tool-call answer: the new text, the changelog and a diff, asked of the scene's model with the tool forced", async () => {
    const r = rig([edited("She opened the door and stepped out.")]);
    const out = await run("She opened the door and stepped into the rain.", [editor()], r);
    expect(out.final).toBe("She opened the door and stepped out.");
    expect(out.changed).toBe(true);
    expect(out.passes[0]).toMatchObject({ type: "editor", status: "applied", changed: true, model: "scene-model", changelog: [{ rule: "POV", description: "fixed" }] });
    expect(out.passes[0]!.diff.some((s) => s.type === "removed")).toBe(true);
    expect(r.sent[0]!.model).toBe("scene-model");
    expect(r.sent[0]!.options.tool_choice).toEqual({ type: "function", function: { name: "submit_edited_message" } });
    expect(r.sent[0]!.options.temperature).toBe(0.35);
    expect(r.sent[0]!.options.max_tokens).toBe(16_000);
  });
  test("a connection that takes no tools gets the tagged form, and the pass says so", async () => {
    const r = rig([{ content: "[CHANGELOG]\n- Tense: fixed\n[REFINED]\nShe went." }], false);
    const out = await run("She goes.", [editor()], r);
    expect(out.final).toBe("She went.");
    expect(r.sent[0]!.options.tools).toBeUndefined();
    expect(out.passes[0]!.warnings).toContain("This connection does not take tool calls, so the pass ran in tagged mode.");
  });
  test("a model written into the reply's text instead of the tool channel is still read", async () => {
    const r = rig([{ content: "```json\n{\"refined\":\"Better.\",\"changelog\":[],\"no_changes_needed\":false}\n```" }]);
    expect((await run("Bad.", [editor()], r)).final).toBe("Better.");
  });
  test("no_changes_needed passes the text through as applied with a clear entry", async () => {
    const r = rig([edited("same", { no_changes_needed: true, changelog: [] })]);
    const out = await run("same", [editor()], r);
    expect(out.passes[0]).toMatchObject({ status: "applied", changed: false });
    expect(out.passes[0]!.changelog[0]!.rule).toBe("No changes needed");
    expect(out.changed).toBe(false);
  });
  test("a translator that says the text is already in the target leaves it, and says why", async () => {
    const r = rig([toolAnswer("submit_translated_message", { translated: "x", changelog: [], no_changes_needed: false, rule_review: null, already_in_target_language: true })]);
    const out = await run("Bonjour", [createPass("translator")], r);
    expect(out.final).toBe("Bonjour");
    expect(out.passes[0]!.changelog.some((c) => c.rule === "Language detection")).toBe(true);
  });
  test("a pass's own connection and temperature are what it is sent with; the thinking is cut from its input", async () => {
    const r = rig([edited("done")]);
    await runFinalCut({ text: "<think>plan</think>Reply", passes: [editor({ connection: { id: "kit2", model: "big" }, temperature: 0.9, maxOutputTokens: 5_000 })], env: { ...r.env, strip: (t) => t.replace(/<think>[\s\S]*?<\/think>/g, "") }, signal: new AbortController().signal });
    expect(r.opened).toEqual(["kit2/big"]);
    expect(r.sent[0]!.model).toBe("big");
    expect(r.sent[0]!.options).toMatchObject({ temperature: 0.9, max_tokens: 5_000 });
    expect(r.sent[0]!.messages[1]!.content).toContain("Original message:\nReply");
    expect(r.sent[0]!.messages[1]!.content).not.toContain("plan");
  });
  test("passes chain: the second reads what the first wrote", async () => {
    const r = rig([edited("first"), toolAnswer("submit_refined_message", { refined: "second", changelog: [{ bank: "AI tells", change: "cut" }], no_changes_needed: false, rule_review: null })]);
    const out = await run("zero", [editor({ order: 0 }), { ...createPass("anti-slop"), order: 10 }], r);
    expect(r.sent[1]!.messages[1]!.content).toContain("Original message:\nfirst");
    expect(out.final).toBe("second");
    expect(out.passes.map((p) => p.type)).toEqual(["editor", "anti-slop"]);
    expect(out.passes[1]!.changelog).toEqual([{ rule: "AI tells", description: "cut" }]);
  });
});

describe("the protected blocks", () => {
  test("a macro the model carried through is restored, and a placeholder that leaks keeps the original", async () => {
    const ok = rig([{ content: "[REFINED]\nHello __FC_PROTECTED_0_MACRO__, welcome back." }], false);
    expect((await run("Hello {{char}}.", [editor({ outputMode: "tagged" })], ok)).final).toBe("Hello {{char}}, welcome back.");
    for (const leak of ["[REFINED]\n__FC_PROTECTED_0_MACRO__ and __FC_PROTECTED_9_MACRO__", "[REFINED]\n__FC_PROTECTED_BLOCK_0__"]) {
      const bad = rig([{ content: leak }], false);
      const out = await run("Hello {{char}}.", [editor({ outputMode: "tagged" })], bad);
      expect(out.final).toBe("Hello {{char}}.");
      expect(out.passes[0]!.status).toBe("skipped");
      expect(out.passes[0]!.warnings.join(" ")).toContain("placeholder");
    }
  });
  test("a lost block skips the pass under Save original reply and only warns under Skip failed pass", async () => {
    const lost = (mode: FinalCutPass["failureMode"]) => run("Hi {{user}}.", [editor({ outputMode: "tagged", failureMode: mode })], rig([{ content: "[REFINED]\nHi there." }], false));
    const fallback = await lost("fallback");
    expect(fallback.passes[0]).toMatchObject({ status: "skipped" });
    expect(fallback.final).toBe("Hi {{user}}.");
    const skip = await lost("skip");
    expect(skip.passes[0]!.status).toBe("applied");
    expect(skip.passes[0]!.warnings.join(" ")).toContain("Protected syntax was not preserved");
  });
  test("an empty body keeps the original; a refusal over a long reply applies but is flagged", async () => {
    const empty = await run("Text.", [editor({ outputMode: "tagged" })], rig([{ content: "[REFINED]\n  " }], false));
    expect(empty.passes[0]!.status).toBe("skipped");
    const long = "The alley smells of rust and rain. ".repeat(20);
    const refused = await run(long, [editor()], rig([edited("I'm sorry, but I cannot continue with this request.")]));
    expect(refused.passes[0]!.status).toBe("applied");
    expect(refused.passes[0]!.warnings.join(" ")).toContain("refusal");
  });
});

describe("failure and retry", () => {
  const boom = (status: number) => new ProviderError("boom", { category: status === 429 ? "rate_limit_error" : "api_error", code: "backend_error", status });
  test("a hiccup is tried once more; auth is not", async () => {
    const r = rig([boom(503), edited("fine")]);
    expect((await run("x", [editor()], r)).final).toBe("fine");
    expect(r.sent).toHaveLength(2);
    const auth = rig([boom(401), edited("never")]);
    const out = await run("x", [editor()], auth);
    expect(auth.sent).toHaveLength(1);
    expect(out.passes[0]!.status).toBe("failed");
    expect(out.passes[0]!.warnings[0]).toContain("refused the key");
    expect(out.final).toBe("x");
  });
  test("a cut-off answer is asked again with half as much room again", async () => {
    const r = rig([{ content: "partial", finish_reason: "length" }, edited("whole")]);
    await run("x", [editor()], r);
    expect(r.sent[1]!.options.max_tokens).toBe(24_000);
  });
  test("reasoning that ate the budget is not retried", async () => {
    const r = rig([{ content: "", finish_reason: "length" }, edited("never")]);
    const out = await run("x", [editor()], r);
    expect(r.sent).toHaveLength(1);
    expect(out.passes[0]!.warnings[0]).toContain("spent its entire token budget");
  });
  test("a changelog with no body is handed back to the model to apply, once", async () => {
    const r = rig([{ content: "[CHANGELOG]\n- Tense: to past" }, { content: "[REFINED]\nShe went." }], false);
    const out = await run("She goes.", [editor({ outputMode: "tagged" })], r);
    expect(out.final).toBe("She went.");
    expect(out.passes[0]!.reflected).toBe(true);
    expect(r.sent[1]!.messages[0]!.content).toContain("executor agent");
    expect(r.sent[1]!.messages[1]!.content).toContain("- Tense: to past");
  });
  test("Skip and Save original reply carry on; Block generation ends the run", async () => {
    for (const failureMode of ["skip", "fallback"] as const) {
      const out = await run("x", [editor({ failureMode, order: 0 }), { ...createPass("validator"), order: 10 }], rig([boom(401)]));
      expect(out.passes.map((p) => p.status)).toEqual(["failed", "applied"]);
    }
    const blocked = await run("x", [editor({ failureMode: "block" })], rig([boom(401)])).then(() => null, (e: unknown) => e);
    expect(blocked).toBeInstanceOf(FinalCutBlocked);
    expect((blocked as FinalCutBlocked).pass).toBe("Editor");
  });
  test("a connection that is gone says so", async () => {
    const r = rig([edited("x")]);
    const out = await runFinalCut({ text: "t", passes: [editor()], env: { ...r.env, open: async () => null }, signal: new AbortController().signal });
    expect(out.passes[0]!.status).toBe("failed");
    expect(out.passes[0]!.warnings[0]).toContain("gone from Kit");
  });
});

describe("Stop and the budget", () => {
  test("a Stop during a pass keeps the text the earlier passes accepted and runs nothing more", async () => {
    const controller = new AbortController();
    const r = rig([edited("first"), () => { controller.abort(new DOMException("stopped", "AbortError")); return new DOMException("stopped", "AbortError") as unknown as Error; }, edited("third")]);
    const out = await run("zero", [editor({ order: 0 }), { ...createPass("anti-slop"), order: 10 }, { ...createPass("translator"), order: 20 }], r, controller.signal);
    expect(out.stopped).toBe("cancelled");
    expect(out.final).toBe("first");
    expect(out.passes.map((p) => p.status)).toEqual(["applied", "failed"]);
    expect(r.sent).toHaveLength(2);
  });
  test("a Stop before the first pass sends nothing", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("stopped", "AbortError"));
    const r = rig([edited("x")]);
    const out = await run("zero", [editor()], r, controller.signal);
    expect(out).toMatchObject({ stopped: "cancelled", final: "zero", passes: [] });
    expect(r.sent).toHaveLength(0);
  });
  test("the budget ends a run that is still waiting on a model", async () => {
    const slow = rig([() => new Promise<never>(() => undefined) as unknown as Error]);
    const send = slow.env.open;
    slow.env.open = async (c) => { const conn = (await send(c))!; return { ...conn, provider: { ...conn.provider, send: (_r: ProviderRequest, io?: { signal?: AbortSignal }) => new Promise<ProviderCompletion>((_, reject) => io?.signal?.addEventListener("abort", () => reject(io.signal!.reason))) } } as Connected; };
    const out = await run("zero", [editor()], slow, new AbortController().signal, 20);
    expect(out.stopped).toBe("timed_out");
    expect(out.final).toBe("zero");
  });
});

describe("the Output Safety Check", () => {
  test("under Block generation an error blocks the reply, and a warning never does", async () => {
    const blocked = await run("The text __FC_PROTECTED_0_MACRO__ leaked.", [{ ...createPass("validator", 0), failureMode: "block" }], rig([edited("x")])).then(() => null, (e: unknown) => e);
    expect(blocked).toBeInstanceOf(FinalCutBlocked);
    const warned = await run("```open", [{ ...createPass("validator", 0), failureMode: "block" }], rig([edited("x")]));
    expect(warned.passes[0]!.status).toBe("applied");
    const kept = await run("The text __FC_PROTECTED_0_MACRO__ leaked.", [createPass("validator", 0)], rig([edited("x")]));
    expect(kept.passes[0]).toMatchObject({ status: "applied", warnings: ["ERROR: A protected syntax placeholder leaked into visible text."] });
  });

  test("warns, calls no model, and never changes the text", async () => {
    const r = rig([edited("never")]);
    const out = await run("```open", [createPass("validator")], r);
    expect(out.passes[0]).toMatchObject({ type: "validator", status: "applied", changed: false });
    expect(out.passes[0]!.warnings).toEqual(["WARNING: A markdown code fence appears to be unclosed."]);
    expect(r.sent).toHaveLength(0);
  });
});
