/**
 * The narrator tool loop: a fake provider asks for tools mid-stream, and every request it
 * receives must pass the same protocol check the real spokes run before sending, so a malformed call can never break the next round.
 */
import { describe, expect, test } from "bun:test";
import type { Provider, ProviderCompletion, ProviderEvent, ProviderMessage, ProviderRequest } from "../contracts/provider";
import { validateToolProtocol } from "./openai-compatible-request";
import { sendWithTools, type NarratorTool, type ToolCallRecord } from "./tool-loop";

const call = (name: string, args: string, id = "call_sse_0") => ({ id, type: "function" as const, function: { name, arguments: args } });
const reply = (content: string, tool_calls?: ReturnType<typeof call>[]): ProviderCompletion => ({ content, ...(tool_calls ? { tool_calls, finish_reason: "tool_calls" } : {}), raw: {} });

/** A provider that answers from a script, streams each reply's text, and records the requests it was sent. */
function scripted(script: ProviderCompletion[]) {
  const requests: ProviderRequest[] = [];
  const provider: Provider = {
    id: "fake",
    async send(request, io) {
      validateToolProtocol(request.messages);
      requests.push(structuredClone(request));
      const next = script[requests.length - 1] ?? reply("");
      if (next.content) io?.onEvent?.({ channel: "content", delta: next.content, startOffset: 0, endOffset: next.content.length });
      return next;
    },
  };
  return { provider, requests };
}

const lookup: NarratorTool<{ q: string }> = {
  access: "read",
  definition: { type: "function", function: { name: "lookup", description: "Look something up.", parameters: { type: "object", properties: { q: { type: "string" } } } } },
  parse: (raw) => (typeof (raw as { q?: unknown }).q === "string" ? { args: { q: (raw as { q: string }).q } } : { error: "q must be a string" }),
  run: async (args) => ({ text: `found ${args.q}`, detail: { hits: 1 } }),
};

const base = (): ProviderRequest => ({ model: "m", messages: [{ role: "user", content: "hi" }], options: { stream: true } });
const cfg = (records: ToolCallRecord[], maxRounds = 8, tools: NarratorTool<never>[] = [lookup as NarratorTool<never>]) => ({ tools, maxRounds, now: () => 1, onCall: (r: ToolCallRecord) => void records.push(r) });

describe("sendWithTools", () => {
  test("a tool that is not read-only is refused before anything is sent, whatever tier it names", async () => {
    for (const access of ["write", "draft", "delete", "egress", "exec", "unknown", undefined, "READ"]) {
      const { provider, requests } = scripted([reply("hi")]);
      const tool = { ...lookup, access } as unknown as NarratorTool<never>;
      const error = await sendWithTools(provider, base(), {}, cfg([], 8, [tool])).then(() => null, (e: unknown) => e);
      expect(String(error)).toMatch(/read-only/);
      expect(requests).toHaveLength(0);
    }
  });

  test("one exception: a write tool declared stateScoped (its only effect is pending scene-state writes a swipe takes back) runs, and nothing else that is not read-only does", async () => {
    const wrote: string[] = [];
    const scoped: NarratorTool<{ q: string }> = { ...lookup, access: "write", stateScoped: true, run: async (a) => (wrote.push(a.q), { text: "saved" }) };
    const { provider, requests } = scripted([reply("", [call("lookup", '{"q":"hp"}')]), reply("Done.")]);
    const records: ToolCallRecord[] = [];
    const done = await sendWithTools(provider, base(), {}, cfg(records, 8, [scoped as NarratorTool<never>]));
    expect(wrote).toEqual(["hp"]);
    expect(done.completion.content).toBe("Done.");
    expect(requests).toHaveLength(2);
    expect(records[0]).toMatchObject({ ok: true, text: "saved" });
    // the flag alone is not enough, and neither is another tier with it
    for (const odd of [{ access: "write" }, { access: "write", stateScoped: false }, { access: "write", stateScoped: "yes" }, { access: "draft", stateScoped: true }, { access: "delete", stateScoped: true }, { access: "exec", stateScoped: true }, { access: "egress", stateScoped: true }]) {
      const again = scripted([reply("hi")]);
      const error = await sendWithTools(again.provider, base(), {}, cfg([], 8, [{ ...lookup, ...odd } as unknown as NarratorTool<never>])).then(() => null, (e: unknown) => e);
      expect(String(error)).toMatch(/read-only/);
      expect(again.requests).toHaveLength(0);
    }
    // one tool that is not allowed refuses the loop, even beside one that is
    const mixed = scripted([reply("hi")]);
    expect(String(await sendWithTools(mixed.provider, base(), {}, cfg([], 8, [scoped, { ...lookup, access: "write" }] as unknown as NarratorTool<never>[])).then(() => null, (e: unknown) => e))).toMatch(/read-only/);
  });

  test("a tool asked for mid-stream gets its result, the reply finishes, and the streamed text is the committed text", async () => {
    const { provider, requests } = scripted([reply("Let me check.", [call("lookup", '{"q":"door"}')]), reply("The door is red.")]);
    const events: ProviderEvent[] = [];
    const records: ToolCallRecord[] = [];
    const done = await sendWithTools(provider, base(), { onEvent: (e) => events.push(e) }, cfg(records));
    expect(requests).toHaveLength(2);
    // F13: the tools are offered with the default choice, never a forced one.
    expect(requests[0]!.options.tools).toHaveLength(1);
    expect(requests[0]!.options.tool_choice).toBeUndefined();
    const second = requests[1]!.messages;
    expect(second.at(-2)).toMatchObject({ role: "assistant", content: "Let me check." });
    expect(second.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call_sse_0", name: "lookup", content: "found door" });
    const streamed = events.flatMap((e) => ("delta" in e ? [e.delta] : [])).join("");
    expect(streamed).toBe("Let me check.\nThe door is red.");
    expect(done.completion.content).toBe(streamed);
    expect(done.rounds).toBe(1);
    expect(records).toMatchObject([{ round: 1, name: "lookup", ok: true, args: '{"q":"door"}', text: "found door", detail: { hits: 1 } }]);
    expect(done.extra).toHaveLength(2);
  });

  test("a reply that asks for nothing is returned untouched and sent once", async () => {
    const { provider, requests } = scripted([reply("Plain.")]);
    const done = await sendWithTools(provider, base(), {}, cfg([]));
    expect(requests).toHaveLength(1);
    expect(done.completion.content).toBe("Plain.");
    expect(done.extra).toEqual([]);
    expect(done.rounds).toBe(0);
  });

  test("rounds are capped: after the last allowed round the model is told to answer, and tool calls it still makes are ignored", async () => {
    const { provider, requests } = scripted([1, 2, 3, 4].map((i) => reply("", [call("lookup", '{"q":"x"}', `c${i}`)])));
    const records: ToolCallRecord[] = [];
    const done = await sendWithTools(provider, base(), {}, cfg(records, 2));
    expect(requests).toHaveLength(3);
    expect(records).toHaveLength(2);
    expect(requests[2]!.options.tool_choice).toBe("none");
    expect(requests[2]!.options.tools).toHaveLength(1);
    expect(done.rounds).toBe(2);
  });

  test("ids are made unique across rounds: a stream reader's call_sse_0 twice would otherwise fail the protocol check", async () => {
    const { provider, requests } = scripted([reply("", [call("lookup", '{"q":"a"}')]), reply("", [call("lookup", '{"q":"b"}')]), reply("done")]);
    await sendWithTools(provider, base(), {}, cfg([]));
    const ids = requests[2]!.messages.flatMap((m) => m.tool_calls?.map((c) => c.id) ?? []);
    expect(new Set(ids).size).toBe(2);
  });

  test("malformed JSON arguments are rejected once, reported to the model and the record, and echoed as an empty object", async () => {
    const { provider, requests } = scripted([reply("", [call("lookup", '{"q":')]), reply("ok")]);
    const records: ToolCallRecord[] = [];
    const done = await sendWithTools(provider, base(), {}, cfg(records));
    expect(done.completion.content).toBe("ok");
    expect(records[0]).toMatchObject({ ok: false });
    expect(records[0]!.error).toContain("not valid JSON");
    const echoed = requests[1]!.messages.find((m) => m.tool_calls)!.tool_calls![0]!;
    expect(echoed.function.arguments).toBe("{}");
    expect(requests[1]!.messages.at(-1)!.content).toContain("not valid JSON");
  });

  test("arguments that fail the tool's schema, unknown tools and unsafe names are reported, never run", async () => {
    let ran = 0;
    const counted: NarratorTool<{ q: string }> = { ...lookup, run: async (a) => (ran++, { text: a.q }) };
    const { provider, requests } = scripted([reply("", [call("lookup", '{"q":7}', "a"), call("nope", "{}", "b"), call("bad name!", "{}", "c")]), reply("fine")]);
    const records: ToolCallRecord[] = [];
    await sendWithTools(provider, base(), {}, cfg(records, 8, [counted as NarratorTool<never>]));
    expect(ran).toBe(0);
    expect(records.map((r) => [r.name, r.ok])).toEqual([["lookup", false], ["nope", false], ["invalid_tool", false]]);
    expect(records[0]!.error).toBe("q must be a string");
    expect(records[1]!.error).toContain("no tool named");
    expect(requests[1]!.messages.filter((m) => m.role === "tool")).toHaveLength(3);
  });

  test("a tool that throws is reported to the model and the loop goes on", async () => {
    const boom: NarratorTool<{ q: string }> = { ...lookup, run: async () => { throw new Error("index unavailable"); } };
    const { provider } = scripted([reply("", [call("lookup", '{"q":"a"}')]), reply("recovered")]);
    const records: ToolCallRecord[] = [];
    const done = await sendWithTools(provider, base(), {}, cfg(records, 8, [boom as NarratorTool<never>]));
    expect(done.completion.content).toBe("recovered");
    expect(records[0]).toMatchObject({ ok: false, error: "index unavailable" });
  });

  test("Stop during a tool ends the loop with the signal's reason, keeps the calls so far, and sends nothing more", async () => {
    const stop = new AbortController();
    const slow: NarratorTool<{ q: string }> = { ...lookup, run: async (a) => (stop.abort(new DOMException("stopped", "AbortError")), { text: a.q }) };
    const { provider, requests } = scripted([reply("", [call("lookup", '{"q":"a"}')]), reply("never")]);
    const records: ToolCallRecord[] = [];
    const error = await sendWithTools(provider, base(), { signal: stop.signal }, cfg(records, 8, [slow as NarratorTool<never>])).then(() => null, (e: unknown) => e);
    expect((error as DOMException).name).toBe("AbortError");
    expect(requests).toHaveLength(1);
    expect(records).toHaveLength(1);
  });

  test("an answer past 12,000 characters is cut and says so, unless the tool declares a larger cap of its own", async () => {
    const long: NarratorTool<{ q: string }> = { ...lookup, run: async () => ({ text: "x".repeat(15_000) }) };
    const paged: NarratorTool<{ q: string }> = { ...long, definition: { ...long.definition, function: { ...long.definition.function, name: "paged" } }, resultCap: 20_000 };
    const { provider } = scripted([reply("", [call("lookup", '{"q":"a"}', "a"), call("paged", '{"q":"a"}', "b")]), reply("end")]);
    const records: ToolCallRecord[] = [];
    await sendWithTools(provider, base(), {}, cfg(records, 8, [long as NarratorTool<never>, paged as NarratorTool<never>]));
    expect(records[0]!.text).toStartWith("x".repeat(12_000) + "\n[cut: the result was longer than 12000 characters]");
    expect(records[1]!.text).toBe("x".repeat(15_000));
  });

  test("with no tools the request is sent as it is, with no tool fields", async () => {
    const { provider, requests } = scripted([reply("x")]);
    await sendWithTools(provider, base(), {}, cfg([], 8, []));
    expect(requests[0]!.options.tools).toBeUndefined();
  });

  test("a reply's reasoning and its details ride on the echoed turn", async () => {
    const first: ProviderCompletion = { ...reply("", [call("lookup", '{"q":"a"}')]), reasoning: "thinking", reasoning_details: [{ type: "reasoning.text", text: "t" }] };
    const { provider, requests } = scripted([first, reply("end")]);
    await sendWithTools(provider, base(), {}, cfg([]));
    const echoed = requests[1]!.messages.find((m: ProviderMessage) => m.tool_calls)!;
    expect(echoed.reasoning).toEqual({ text: "thinking", provider: "fake" });
    expect(echoed.reasoning_details).toEqual([{ type: "reasoning.text", text: "t" }]);
  });
});

describe("the tool time budget (owner rule: a mechanism, not a fixed step count)", () => {
  // a clock that moves 10 ms every time the loop or a tool reads it
  const ticking = () => { let t = 0; return () => (t += 10); };
  const seen: (ToolDeadlineSeen | undefined)[] = [];
  type ToolDeadlineSeen = { at: number; now(): number };
  const timed: NarratorTool<{ q: string }> = { ...lookup, run: async (args, _signal, deadline) => (seen.push(deadline), { text: `found ${args.q}` }) };

  test("every run is handed what is left of the budget as a deadline, and a spent budget answers the call with an error and runs nothing", async () => {
    seen.length = 0;
    const now = ticking();
    const { provider } = scripted([reply("", [call("lookup", '{"q":"a"}', "c1"), call("lookup", '{"q":"b"}', "c2"), call("lookup", '{"q":"c"}', "c3")]), reply("Done.")]);
    const records: ToolCallRecord[] = [];
    await sendWithTools(provider, base(), {}, { tools: [timed as NarratorTool<never>], maxRounds: 4, now, onCall: (r) => void records.push(r), toolBudgetMs: 15 });
    expect(seen.filter(Boolean).length).toBe(records.filter((r) => r.ok).length);
    expect(seen[0]!.at).toBeGreaterThan(0);
    // the second and third calls come after the budget has run down
    const failed = records.filter((r) => !r.ok);
    expect(failed.length).toBeGreaterThan(0);
    expect(failed[0]!.error).toBe("The tool time budget for this reply is spent.");
    expect(records[0]!.ok).toBe(true);
  });

  test("with no budget a tool gets no deadline", async () => {
    seen.length = 0;
    const { provider } = scripted([reply("", [call("lookup", '{"q":"a"}')]), reply("Done.")]);
    await sendWithTools(provider, base(), {}, cfg([], 8, [timed as NarratorTool<never>]));
    expect(seen).toEqual([undefined]);
  });
});

describe("second fix round: a spent tool budget and a state-scoped write", () => {
  const ticking = () => { let t = 0; return () => (t += 10); };
  const seen: (number | undefined)[] = [];
  const scopedTool = (text: string): NarratorTool<{ q: string }> => ({ ...lookup, access: "write", stateScoped: true, run: async (args, _s, deadline) => (seen.push(deadline?.at), { text: text + args.q }) });

  test("6: once the budget is spent a plain tool is refused and a state-scoped write still runs (it keeps the narration and the state in step)", async () => {
    seen.length = 0;
    const plain: NarratorTool<{ q: string }> = { ...lookup, definition: { ...lookup.definition, function: { ...lookup.definition.function, name: "plain" } } };
    const scoped = scopedTool("saved ") as never as NarratorTool<never>;
    const { provider } = scripted([reply("", [call("plain", '{"q":"a"}', "c1"), call("plain", '{"q":"b"}', "c2"), call("lookup", '{"q":"c"}', "c3")]), reply("Done.")]);
    const records: ToolCallRecord[] = [];
    await sendWithTools(provider, base(), {}, { tools: [plain as never, scoped], maxRounds: 4, now: ticking(), onCall: (r) => void records.push(r), toolBudgetMs: 1 });
    expect(records.map((r) => [r.name, r.ok])).toEqual([["plain", true], ["plain", false], ["lookup", true]]);
    expect(records[1]!.error).toBe("The tool time budget for this reply is spent.");
    expect(records[2]!.text).toBe("saved c");
    // it is given no deadline: a big call must not fail after the budget is gone
    expect(seen).toEqual([undefined]);
  });

  test("8: the loop shortens a very large answer, except a state-scoped tool's (a tracker's text is never cut)", async () => {
    const big = "y".repeat(30_000);
    const plain: NarratorTool<{ q: string }> = { ...lookup, run: async () => ({ text: big }) };
    const scoped: NarratorTool<{ q: string }> = { ...scopedTool(""), definition: { ...lookup.definition, function: { ...lookup.definition.function, name: "scoped" } }, run: async () => ({ text: big }) };
    for (const [tool, name, whole] of [[plain, "lookup", false], [scoped, "scoped", true]] as const) {
      const { provider } = scripted([reply("", [call(name, '{"q":"a"}')]), reply("Done.")]);
      const records: ToolCallRecord[] = [];
      await sendWithTools(provider, base(), {}, { tools: [tool as never], maxRounds: 3, now: () => 1, onCall: (r) => void records.push(r) });
      expect(records[0]!.text.length === big.length, name).toBe(whole);
    }
  });
});
