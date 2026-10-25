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
