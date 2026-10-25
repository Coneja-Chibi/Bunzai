/**
 * The Story Director through the turn loop (plan 15) against a scripted provider: one forced command before the reply, the directive in front of the last user
 * message with the contract once, a failure that gives no directive and never re-sends the last one, the retries, Continue skipping it, a snapshot stored only when the reply commits and
 * rolled back by a swipe or a fork, and Stop reaching the Director's call. The person's edits, the turn count and the bounds are in scene-turn-director-edits.test.ts.
 */
import { describe, expect, test } from "bun:test";
import { DIRECTOR_HEADER, NARRATOR_AUTHORITY } from "../core/assembly/director";
import { blankDirector } from "../stage/contracts/chat-store.contract-director";
import type { DirectorState } from "../stage/contracts/director-types";
import { ProviderError, type ProviderCompletion } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { ARGS, buildScene, call, contents, text, type SceneOptions } from "./fake-director-rig";
import { stopTurn, type TurnEvent } from "./scene-turn";

const scene = (opts: SceneOptions = {}) => buildScene(opts, (clock) => ({ chats: memoryChatStore(clock), state: memoryStateStore() }));

describe("a reply with the Director on", () => {
  test("one command is forced; the directive sits immediately above the last user message and the contract is first, once; the trace and the events say so", async () => {
    const s = await scene();
    await s.turn();
    expect(s.planner).toHaveLength(1);
    const req = s.planner[0]!;
    expect(req.options.tools?.map((t) => t.function.name)).toEqual(["commit_planning_round"]);
    expect(req.options.tool_choice).toEqual({ type: "function", function: { name: "commit_planning_round" } });
    expect(req.options.stream).toBe(false);
    expect(req.messages[1]!.content).toContain("### User's Action\nAny storms?");
    const sent = contents(s.narrator[0]!);
    expect(sent[0]).toBe(NARRATOR_AUTHORITY);
    expect(sent.filter((c) => c === NARRATOR_AUTHORITY)).toHaveLength(1);
    expect(sent.at(-1)).toBe("Any storms?");
    expect(sent.at(-2)!.startsWith(DIRECTOR_HEADER)).toBe(true);
    expect(sent.at(-2)).toContain("Narrative Goal: Let Vera slip once.");
    const m = await s.tip();
    const trace = (await s.chats.swipeTrace(m.id, m.swipes[m.current]!.id)) as { blocks: { source: { kind: string } }[] };
    expect(trace.blocks.filter((b) => b.source.kind === "director")).toHaveLength(2);
    expect(trace.blocks).toHaveLength(sent.length);
    expect(s.events.filter((e) => e.type === "director").map((e) => (e as { status: string }).status)).toEqual(["planning", "planned"]);
  });

  test("the reply's snapshot has the round applied: the first chapter, the arc with its next beat, the seed, the analysis and the directive for the next self-audit", async () => {
    const s = await scene();
    await s.turn();
    const snap = (await s.stored())!;
    expect(snap.messageId).toBe((await s.tip()).id);
    expect(snap.state.chapters).toMatchObject([{ number: 1, title: "Arrival" }]);
    expect(snap.state.arcs).toMatchObject([{ title: "The Lamp", nextBeat: { description: "A servant drops a key", status: "pending" } }]);
    expect(snap.state.seeds).toMatchObject([{ hint: "The cracked bell", plantedAtTurn: 1 }]);
    expect(snap.state.lastDirective).toMatchObject({ mood: "uneasy" });
    expect(snap.state.lastDirectiveTurn).toBe(1);
    expect(snap.state.activity.map((a) => a.type)).toEqual(["turn_start", "arc", "seed", "directive", "turn_finish"]);
  });

  test("with the Director off nothing is asked, nothing is injected, nothing is stored", async () => {
    const s = await scene({ on: false });
    await s.turn();
    expect(s.planner).toHaveLength(0);
    expect(contents(s.narrator[0]!).some((c) => c === NARRATOR_AUTHORITY || c.startsWith(DIRECTOR_HEADER))).toBe(false);
    expect(await s.stored()).toBeNull();
    expect(s.events.some((e) => e.type === "director")).toBe(false);
  });

  test("the settings reach the call: temperature, reasoning, the personality and the creativity line", async () => {
    const s = await scene({ settings: { temperature: 1.2, reasoning: "low", personality: "the-jester", creativity: "dramatic", instructions: "No sudden villains." } });
    await s.turn();
    const req = s.planner[0]!;
    expect(req.options).toMatchObject({ temperature: 1.2, reasoning_effort: "low" });
    expect(req.messages[0]!.content).toContain("## Creativity Level: DRAMATIC");
    expect(req.messages[0]!.content).toContain("Felix");
    expect(req.messages[1]!.content).toContain("No sudden villains.");
  });

  test("a regenerate plans again from the state its first answer started from, and Continue does not plan at all", async () => {
    const s = await scene();
    await s.turn();
    await s.turn("swipe");
    expect(s.planner).toHaveLength(2);
    // Both plans started from an empty story: the second never saw the first's chapter and arc.
    expect(s.planner[1]!.messages[1]!.content).toContain("No chapter defined yet");
    await s.turn("continue");
    expect(s.planner).toHaveLength(2);
    expect(contents(s.narrator.at(-1)!).some((c) => c.startsWith(DIRECTOR_HEADER))).toBe(false);
    expect(s.events.filter((e) => e.type === "director")).toHaveLength(4);
  });
});

describe("when planning fails", () => {
  test("no directive is sent - not even the last one, which the story still holds - the reply is written, the story fields stay, one honest line is kept", async () => {
    const s = await scene({ planner: [call(ARGS()), new ProviderError("down", { category: "api_error", code: "backend_error", status: 500 }), new ProviderError("down", { category: "api_error", code: "backend_error", status: 500 })] });
    await s.turn();
    const first = (await s.stored())!.state;
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "And then?" });
    await s.turn();
    expect(s.planner.length).toBeGreaterThanOrEqual(2);
    const sent = contents(s.narrator[1]!);
    expect(sent.some((c) => c === NARRATOR_AUTHORITY || c.startsWith(DIRECTOR_HEADER))).toBe(false);
    const after = (await s.stored())!.state;
    expect(after.lastDirective).toEqual(first.lastDirective);
    expect({ ...after, activity: [], nextId: 0, turn: 0 }).toEqual({ ...first, activity: [], nextId: 0, turn: 0 });
    expect([first.turn, after.turn]).toEqual([1, 2]);
    expect(after.activity.at(-1)).toMatchObject({ type: "turn_error", result: "error", description: "Story Director could not reach a working provider." });
    expect(s.events.filter((e) => e.type === "director").at(-1)).toMatchObject({ status: "failed", reason: "Story Director could not reach a working provider." });
    expect(s.events.some((e) => e.type === "done")).toBe(true);
  });

  test("a model that makes no call at all says so, in RoleCall's words; the details never carry the provider's message", async () => {
    const s = await scene({ planner: [text("I would rather chat."), text("Still no.")] });
    await s.turn();
    const a = (await s.stored())!.state.activity;
    expect(a.map((x) => x.description)).toEqual(["Turn 1 - Director planning", "Story Director returned no planning command.", "Turn 1 - DM made 0 tool calls; story state was NOT updated"]);
    const leaky = await scene({ planner: [new ProviderError("secret prompt excerpt sk-abc123", { category: "api_error", code: "backend_error", status: 500 }), new ProviderError("secret prompt excerpt sk-abc123", { category: "api_error", code: "backend_error", status: 500 })] });
    await leaky.turn();
    expect(JSON.stringify((await leaky.stored())!.state)).not.toContain("sk-abc123");
  });

  test("a Tool call scene on a connection that takes no tools fails closed and says why; no call is made", async () => {
    const s = await scene({ tools: false });
    await s.turn();
    expect(s.planner).toHaveLength(0);
    expect((await s.stored())!.state.activity.at(-1)).toMatchObject({ type: "turn_error", description: expect.stringContaining("needs a model with tool calling") });
    expect(s.events.some((e) => e.type === "done")).toBe(true);
  });

  test("a Director model Kit no longer has fails closed with that said", async () => {
    const s = await scene({ settings: { model: { id: "gone", model: "x" } } });
    const connect = s.deps.connect;
    s.deps.connect = async (c?: { id: string; model: string }) => (c?.id === "gone" ? null : connect());
    await s.turn();
    expect(s.planner).toHaveLength(0);
    expect((await s.stored())!.state.activity.at(-1)!.description).toContain("no longer in Kit");
  });
});

describe("retries", () => {
  const refuse = (status: number) => new ProviderError("busy", { category: "rate_limit_error", code: "rate_limit_exceeded", status });

  test.each([429, 502, 503, 504, 524])("a %i is re-sent once, after a pause of 600 to 1,000 ms, and the reply gets its directive", async (status) => {
    const s = await scene({ planner: [refuse(status), call(ARGS())] });
    await s.turn();
    expect(s.planner).toHaveLength(2);
    expect(s.sleeps).toEqual([800]);
    expect(contents(s.narrator[0]!).some((c) => c.startsWith(DIRECTOR_HEADER))).toBe(true);
  });

  test("a 500 or a 400 is not re-sent; two refusals in a row fail after one re-send", async () => {
    const a = await scene({ planner: [new ProviderError("bad", { category: "invalid_request_error", code: "invalid_parameter", status: 400 })] });
    await a.turn();
    expect(a.planner).toHaveLength(1);
    expect(a.sleeps).toEqual([]);
    const b = await scene({ planner: [refuse(429), refuse(429), call(ARGS())] });
    await b.turn();
    expect(b.planner).toHaveLength(2);
    expect((await b.stored())!.state.activity.at(-1)!.type).toBe("turn_error");
  });

  test("a reply that is not a usable command gets one corrective pass with the bad reply in context; a transient refusal does not use it up", async () => {
    const s = await scene({ planner: [refuse(429), text("Here is my plan in prose."), call(ARGS())] });
    await s.turn();
    expect(s.planner).toHaveLength(3);
    const last = s.planner[2]!.messages;
    expect(last.at(-2)).toEqual({ role: "assistant", content: "Here is my plan in prose." });
    expect(last.at(-1)!.content).toContain("That response did not complete the required commit_planning_round command.");
    expect(last.at(-1)!.content).toContain("through the provided native tool interface");
    expect(contents(s.narrator[0]!).some((c) => c.startsWith(DIRECTOR_HEADER))).toBe(true);
  });

  test("the corrective pass happens once, only while Auto-retry is on, and a wrong command or a directive-less one is not a plan", async () => {
    const off = await scene({ settings: { autoRetry: false }, planner: [text("prose"), call(ARGS())] });
    await off.turn();
    expect(off.planner).toHaveLength(1);
    const twice = await scene({ planner: [text("prose"), text("more prose"), call(ARGS())] });
    await twice.turn();
    expect(twice.planner).toHaveLength(2);
    const wrong = await scene({ planner: [call({}, "set_directive"), call({ directive: { mood: "x" } })] });
    await wrong.turn();
    expect((await wrong.stored())!.state.activity.map((a) => a.description)).toContain("Story Director's planning command did not include a narrator directive.");
  });
});

describe("Tagged", () => {
  test("no tools are sent; the command is asked for as a text block, read with the same reader, and a connection without tools is fine", async () => {
    const block = `<tool_call>${JSON.stringify({ name: "commit_planning_round", arguments: ARGS() })}</tool_call>`;
    const s = await scene({ tools: false, settings: { commandMode: "tagged" }, planner: [text(`Thinking aloud.\n${block}`)] });
    await s.turn();
    expect(s.planner[0]!.options.tools).toBeUndefined();
    expect(s.planner[0]!.messages[0]!.content).toContain("<tool_call>");
    expect(contents(s.narrator[0]!).some((c) => c.startsWith(DIRECTOR_HEADER))).toBe(true);
  });

  test("a block that cannot be decoded is a failure with that said, after its one corrective pass", async () => {
    const s = await scene({ settings: { commandMode: "tagged" }, planner: [text("<tool_call>{nope</tool_call>"), text("<tool_call>{nope</tool_call>")] });
    await s.turn();
    expect(s.planner).toHaveLength(2);
    expect(s.planner[1]!.messages.at(-1)!.content).toContain("return exactly one <tool_call> block");
    expect((await s.stored())!.state.activity.at(-1)!.description).toBe("Story Director commands could not be decoded.");
  });
});

describe("the snapshot belongs to the reply", () => {
  test("a reply that fails leaves no snapshot", async () => {
    const s = await scene({ narrator: new ProviderError("down", { category: "api_error", code: "backend_error", status: 500 }) });
    await s.turn();
    expect(s.events.some((e) => e.type === "failed")).toBe(true);
    expect(await s.stored()).toBeNull();
  });

  test("Stop while the Director is planning aborts its call, drops the turn, and stores nothing", async () => {
    const s = await scene({ planner: ["hang"] });
    const run = s.turn();
    for (let i = 0; i < 200 && !s.events.some((e) => e.type === "start"); i++) await Bun.sleep(5);
    for (let i = 0; i < 200 && s.planner.length === 0; i++) await Bun.sleep(5);
    const started = s.events.find((e) => e.type === "start") as Extract<TurnEvent, { type: "start" }>;
    stopTurn(s.chat.id, started.turnId);
    await run;
    expect(s.aborted).toEqual([true]);
    expect(s.events.at(-1)).toEqual({ type: "stopped", message: null });
    expect(s.narrator).toHaveLength(0);
    expect(await s.stored()).toBeNull();
  });

  test("a swipe has its own snapshot: selecting the first version brings back the first state, the second brings back the second, and a fork carries the one it copies", async () => {
    const s = await scene({ planner: [call(ARGS()), call(ARGS({ chapterUpdate: { action: "start_new", title: "Second Arrival" } }))] });
    await s.turn();
    await s.turn("swipe");
    const reply = await s.tip();
    expect((await s.chats.getDirector(s.chat.id, reply.id))!.state.chapters[0]!.title).toBe("Second Arrival");
    await s.chats.selectSwipe(reply.id, 0);
    expect((await s.chats.getDirector(s.chat.id, reply.id))!.state.chapters[0]!.title).toBe("Arrival");
    const fork = (await s.chats.fork(s.chat.activeBranchId, reply.id, { name: "Take 2" }))!;
    const copied = (await s.chats.readMessages(fork.id, { limit: 10 })).messages.at(-1)!;
    expect((await s.chats.getDirector(s.chat.id, copied.id))!.state.chapters[0]!.title).toBe("Arrival");
  });

  test("a person's edit made while the call was out is carried over, not overwritten: the round is applied to the state in effect at the reply", async () => {
    let release!: (c: ProviderCompletion) => void;
    const gate = new Promise<ProviderCompletion>((resolve) => { release = resolve; });
    const s = await scene({ planner: [gate] });
    const run = s.turn();
    for (let i = 0; i < 200 && s.planner.length === 0; i++) await Bun.sleep(5);
    // The person adds a note at the tip, which is still the user's message while the call is out.
    const user = await s.tip();
    await s.chats.putDirector(s.chat.id, user.id, blankDirector("Keep Vera kind."), { expectedVersion: null });
    release(call(ARGS()));
    await run;
    const snap = (await s.stored())!;
    expect(snap.messageId).toBe((await s.tip()).id);
    expect(snap.state.notes.map((n) => n.content)).toEqual(["Keep Vera kind."]);
    expect(snap.state.arcs.map((a) => a.title)).toEqual(["The Lamp"]);
  });

  test("produce() on a state an edit changed keeps the edit and still applies the round", async () => {
    const s = await scene();
    const { runDirector } = await import("./scene-director");
    const loaded = { history: [{ id: "h", role: "assistant" as const, content: "Evening." }], current: { id: "u", role: "user" as const, content: "Any storms?" } };
    const chat = (await s.chats.getChat(s.chat.id))!;
    const run = (await runDirector(s.deps, chat, loaded as never, { connected: (await s.deps.connect())!, model: "m" }, new AbortController().signal, { kind: "reply", format: undefined }))!;
    expect(run.status).toBe("planned");
    const edited: DirectorState = blankDirector("Keep Vera kind.");
    const next = run.produce(edited);
    expect(next.notes.map((n) => n.content)).toEqual(["Keep Vera kind."]);
    expect(next.arcs.map((a) => a.title)).toEqual(["The Lamp"]);
    expect(next.activity.map((a) => a.type)).toEqual(["turn_start", "arc", "seed", "directive", "turn_finish"]);
  });
});

describe("the Compendium in the planner's prompt", () => {
  const block = (s: Awaited<ReturnType<typeof scene>>) => s.planner[0]!.messages[1]!.content;

  test("the books the Compendium may read are in it, scene first; a book set to off or write only is not; the Compendium off sends none", async () => {
    const read = await scene({ compendium: { on: true } });
    await read.turn();
    expect(block(read)).toContain("[COMPENDIUM CONTEXT]\nCharacters:\n  - Mira: Keeps the second ledger.");
    expect(block(read)).toContain("Key Locations:\n  - The Pier: Salt and rope.");
    expect(block(read)).toContain("Tension: Mira / Vera: rival relationship (active)");
    for (const access of ["off", "write_only"] as const) {
      const shut = await scene({ compendium: { on: true, books: { b1: { access } } } });
      await shut.turn();
      expect(block(shut)).not.toContain("COMPENDIUM CONTEXT");
      expect(block(shut)).not.toContain("Mira");
    }
    const off = await scene();
    await off.turn();
    expect(block(off)).not.toContain("COMPENDIUM CONTEXT");
    const some = await scene({ compendium: { on: true, books: { b1: { access: "read_write" } } } });
    await some.turn();
    expect(block(some)).toContain("COMPENDIUM CONTEXT");
  });
});
