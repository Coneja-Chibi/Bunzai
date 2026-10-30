/**
 * The Dramaturg's read tools (studio/dramaturg-tools.ts; specs/stage/dramaturg.md, "Tools"), over a scene on the memory store: all six at
 * `read`, so the narrator loop takes them and refuses the list with anything else; the scene's own "#n" numbering agreeing with the
 * store's live ordinal; hidden messages never returned; budgeted paging with `next_from`; the rule 35 search and its limits; the lore
 * search and entry read over the scene's books; and a preset block by name or identifier.
 */
import { describe, expect, test } from "bun:test";
import { emptyLoreEntry, emptyLorebookBody } from "../core/lore";
import type { PresetPromptInfo } from "../core/macros";
import type { Provider } from "../stage/contracts/provider";
import { sendWithTools, type NarratorTool, type ToolCallRecord } from "../stage/provider/tool-loop";
import { memoryChatStore } from "../stage/store/chat-store";
import { dramaturgTools, readSummary, sceneLines, type DramaturgScene } from "./dramaturg-tools";
import { WHOLE_BRANCH } from "./scene-branch";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } };
const NAMES = ["list_scene_messages", "search_scene_messages", "read_scene_messages", "search_lorebook", "read_lorebook_entry", "read_preset_block"];
const entry = (id: string, title: string, content: string, over: Partial<ReturnType<typeof emptyLoreEntry>> = {}) => ({ ...emptyLoreEntry(id), title, content, ...over });
const BOOKS = [
  { id: "b1", name: "Harbor", body: { ...emptyLorebookBody("Harbor"), entries: [entry("x1", "Mira", "Keeps the second ledger. Her sister drowned."), entry("x2", "The Pier", "Salt and rope.", { constant: true }), entry("x3", "Old Bell", "Rings for a sister lost.", { enabled: false, triggers: [{ keyword: "bell", isRegex: false }] })] } },
  { id: "b2", name: "Town", body: { ...emptyLorebookBody("Town"), entries: Array.from({ length: 25 }, (_, i) => entry(`t${i}`, `Street ${i}`, "A lamp street.")) } },
];
const BLOCKS: PresetPromptInfo[] = [{ id: "main", identifier: "main", name: "Main Prompt", enabled: true, content: "Write as Vera." }, { id: "terse", identifier: "terse", name: "Terse Mode", enabled: false, content: "Short replies only." }];

async function scene(texts: string[] = ["Evening.", "Any storms?", "One is coming.", "My sister saw it.", "Your sister lies.", "Hush."], reading: Parameters<typeof sceneLines>[3] = {}) {
  const chats = memoryChatStore(() => 1);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  const branchId = chat.activeBranchId;
  const appended = (await chats.appendMessages(branchId, texts.map((content, i) => ({ role: i % 2 === 0 ? "assistant" as const : "user" as const, content }))))!;
  const read = async () => sceneLines((await chats.readMessages(branchId, { limit: WHOLE_BRANCH })).messages, "Vera", "Mira", reading);
  const make = async (): Promise<{ s: DramaturgScene; tools: NarratorTool<never>[] }> => {
    const s = { branchId, lines: await read(), books: BOOKS, blocks: BLOCKS };
    return { s, tools: dramaturgTools(s, chats) };
  };
  return { chats, branchId, appended, make };
}

/** One call as the loop makes it: parsed, then run; a refusal at either step is `error`. */
async function run(tools: NarratorTool<never>[], name: string, raw: Record<string, unknown>): Promise<{ text: string; detail?: Record<string, unknown>; error?: string }> {
  const t = tools.find((x) => x.definition.function.name === name)!;
  const parsed = t.parse(raw);
  if ("error" in parsed) return { text: "", error: parsed.error };
  return t.run(parsed.args, undefined).then((o) => o, (e: Error) => ({ text: "", error: e.message }));
}

describe("the tool list", () => {
  test("the six, every one read, with strict schemas, so the narrator loop runs them; any other tier in the list is refused", async () => {
    const { tools } = await (await scene()).make();
    expect(tools.map((t) => t.definition.function.name)).toEqual(NAMES);
    expect(tools.every((t) => t.access === "read")).toBe(true);
    expect(tools.every((t) => (t.definition.function.parameters as { additionalProperties?: boolean }).additionalProperties === false)).toBe(true);
    const provider: Provider = { id: "p", send: async () => ({ content: "ok", raw: {} }) };
    const cfg = (list: NarratorTool<never>[]) => ({ tools: list, maxRounds: 8, now: () => 1, onCall: () => {} });
    expect((await sendWithTools(provider, { model: "m", messages: [], options: {} }, {}, cfg(tools))).completion.content).toBe("ok");
    for (const access of ["write", "draft", "delete", "egress", "exec", "unknown"]) {
      const bad = tools.map((t, i) => (i === 2 ? { ...t, access } : t)) as NarratorTool<never>[];
      const error = await sendWithTools(provider, { model: "m", messages: [], options: {} }, {}, cfg(bad)).then(() => null, (e: unknown) => e);
      expect(String(error)).toContain("read_scene_messages is declared");
    }
  });

  test("an unknown argument is refused by name", async () => {
    const { tools } = await (await scene()).make();
    expect(await run(tools, "read_scene_messages", { from: 1, to: 2, all: true })).toMatchObject({ error: expect.stringContaining("all") });
  });
});

describe("the scene's numbering", () => {
  test("#n is 1-based among live messages, greeting included, hidden counted, cut left out: the store's live ordinal plus one", async () => {
    const sc = await scene();
    await sc.chats.setHidden(sc.appended[2]!.id, true);
    await sc.chats.cutMessages(sc.branchId, sc.appended[1]!.id, "one");
    const { s } = await sc.make();
    expect(s.lines.map((l) => [l.number, l.text, l.hidden, l.speaker])).toEqual([[1, "Evening.", false, "Vera"], [2, "One is coming.", true, "Vera"], [3, "My sister saw it.", false, "You"], [4, "Your sister lies.", false, "Vera"], [5, "Hush.", false, "You"]]);
    const hits = await sc.chats.searchMessages(sc.branchId, { words: ["sister"], limit: 10 });
    expect(hits.hits.map((h) => h.index + 1)).toEqual([4, 3]);
    const at = await sc.chats.readMessagesAt(sc.branchId, [0, 2, 4]);
    expect(at.messages.map((m) => m.content)).toEqual([s.lines[0]!.text, s.lines[2]!.text, s.lines[4]!.text]);
  });

  test("a user message is named as the scene names it: the persona it was written as, You for none, else the scene's persona or You", async () => {
    const said = (persona: { id: string; name: string } | null | undefined, current: string) =>
      sceneLines([{ id: "m", branchId: "b", seq: 1, role: "user", swipes: [{ id: "s", content: "hi", createdAt: 1 } as never], current: 0, createdAt: 1, ...(persona === undefined ? {} : { persona }) }], "Vera", current, {})[0]!.speaker;
    expect(said({ id: "p2", name: "Ada" }, "Mira")).toBe("Ada");
    expect(said(null, "Mira")).toBe("You");
    expect(said(undefined, "Mira")).toBe("Mira");
    expect(said(undefined, "")).toBe("You");
  });

  test("a reply reads as the narrator read it: its thinking and any tool-call leak are out, unless the scene keeps thinking", async () => {
    const texts = ["<think>She plans a lie.</think>Evening.", "Any storms?", "None.<tool_call>{\"name\":\"x\"}</tool_call>"];
    const { s, tools } = await (await scene(texts, { reasoning: { prefix: "", suffix: "", separator: "" } })).make();
    expect(s.lines.map((l) => l.text)).toEqual(["Evening.", "Any storms?", "None."]);
    const read = await run(tools, "read_scene_messages", { from: 1, to: 3 });
    expect(read.text).not.toMatch(/plans a lie|tool_call/);
    expect((await run(tools, "list_scene_messages", {})).text).not.toContain("plans");
    expect((await run(tools, "search_scene_messages", { words: "lie" })).text).toContain("No visible message");
    const kept = await (await scene(texts, { keepThinking: true })).make();
    expect(kept.s.lines[0]!.text).toBe("<think>She plans a lie.</think>Evening.");
    expect(kept.s.lines[2]!.text).toBe("None.");
  });
});

describe("list_scene_messages", () => {
  test("numbers, speakers and first lines; a hidden one says so and shows nothing of itself", async () => {
    const sc = await scene();
    await sc.chats.setHidden(sc.appended[3]!.id, true);
    const { tools } = await sc.make();
    const out = await run(tools, "list_scene_messages", {});
    expect(out.text).toContain("#1 Vera: Evening.");
    expect(out.text).toContain("#4 is hidden: the narrator did not see it.");
    expect(out.text).not.toContain("My sister saw it");
    expect(out.detail).toMatchObject({ summary: "listed messages #1 to #6" });
  });

  test("at most 100 per call, with next_from; past the end is refused", async () => {
    const { tools } = await (await scene(Array.from({ length: 130 }, (_, i) => `m${i + 1} ${"y".repeat(20)}`))).make();
    const out = await run(tools, "list_scene_messages", { from: 11 });
    expect(out.text).toContain("#110 You: m110");
    expect(out.text).not.toContain("#111 ");
    expect(out.text).toContain("next_from: 111");
    expect((await run(tools, "list_scene_messages", { from: 200 })).error).toContain("130 messages");
    expect((await run(tools, "list_scene_messages", { from: 0 })).error).toContain("from");
    expect((await run(tools, "list_scene_messages", { from: 5, to: 3 })).error).toContain("before");
  });
});

describe("read_scene_messages", () => {
  test("whole messages, the hidden one named and never returned, and next_from null once the range is read", async () => {
    const sc = await scene();
    await sc.chats.setHidden(sc.appended[3]!.id, true);
    const { tools } = await sc.make();
    const out = await run(tools, "read_scene_messages", { from: 3, to: 5 });
    expect(out.text).toContain("returned: #3 to #5");
    expect(out.text).toContain("next_from: null");
    expect(out.text).toContain("#3 Vera:\nOne is coming.");
    expect(out.text).toContain("#4 is hidden: the narrator did not see it.");
    expect(out.text).not.toContain("My sister saw it");
    expect(out.detail).toMatchObject({ summary: "read messages #3 to #5", next_from: null });
    expect((await run(tools, "read_scene_messages", { from: 3 })).error).toContain("to");
  });

  test("a page holds at most 18,000 characters of messages; next_from names the first unread, and the loop passes the page whole", async () => {
    const { tools } = await (await scene(Array.from({ length: 12 }, (_, i) => `${i + 1}:${"w".repeat(4_000)}`))).make();
    const first = await run(tools, "read_scene_messages", { from: 1, to: 12 });
    expect(first.text).toContain("returned: #1 to #4");
    expect(first.text).toContain("next_from: 5");
    expect(first.text).toContain("You have not read #5 to #12");
    expect(first.text).not.toContain("#5 Vera:");
    expect(first.text.length).toBeLessThanOrEqual(tools[2]!.resultCap!);
    const second = await run(tools, "read_scene_messages", { from: 5, to: 12 });
    expect(second.text).toContain("returned: #5 to #8");
    const last = await run(tools, "read_scene_messages", { from: 9, to: 40 });
    expect(last.text).toContain("returned: #9 to #12");
    expect(last.text).toContain("next_from: null");
    expect(last.text).toContain("The scene ends at #12.");
  });

  test("one message longer than a page is clipped and says so, and paging still moves on", async () => {
    const { tools } = await (await scene(["short", "z".repeat(25_000), "after"])).make();
    const out = await run(tools, "read_scene_messages", { from: 2, to: 3 });
    expect(out.text).toContain("returned: #2 to #2");
    expect(out.text).toContain("next_from: 3");
    expect(out.text).toMatch(/#2 continues for \d+ more characters/);
  });
});

describe("search_scene_messages", () => {
  test("every word present, newest first, with an excerpt; a hidden message is never returned", async () => {
    const sc = await scene();
    await sc.chats.setHidden(sc.appended[4]!.id, true);
    const { tools } = await sc.make();
    const out = await run(tools, "search_scene_messages", { words: "SISTER saw" });
    expect(out.text).toContain("#4 You: My sister saw it.");
    expect(out.text).not.toContain("#5");
    expect(out.detail).toMatchObject({ summary: 'searched the scene for "sister saw" (1 found)' });
    const none = await run(tools, "search_scene_messages", { words: "lies" });
    expect(none.text).toContain("No visible message");
  });

  test("1 to 8 words of 2 to 200 characters, as a string or a list", async () => {
    const { tools } = await (await scene()).make();
    for (const words of ["", "a", "one two three four five six seven eight nine", 5]) expect((await run(tools, "search_scene_messages", { words })).error).toContain("1 to 8 words");
    expect((await run(tools, "search_scene_messages", { words: ["sister", "lies"] })).text).toContain("#5 Vera: Your sister lies.");
  });

  test("at most 40 numbers, newest first, and it says when more match", async () => {
    const { tools } = await (await scene(Array.from({ length: 60 }, (_, i) => `lamp ${i + 1}`))).make();
    const out = await run(tools, "search_scene_messages", { words: "lamp" });
    expect(out.text.split("\n").filter((l) => l.startsWith("#"))).toHaveLength(40);
    expect(out.text.indexOf("#60 ")).toBeLessThan(out.text.indexOf("#59 "));
    expect(out.text).toContain("More match");
  });
});

describe("the lore and the preset", () => {
  test("search_lorebook searches title and content across the scene's books, with handles; an entry that is off says so", async () => {
    const { tools } = await (await scene()).make();
    const out = await run(tools, "search_lorebook", { words: "sister" });
    expect(out.text).toContain("[e1] Mira (Harbor)");
    expect(out.text).toMatch(/\[e3\] Old Bell \(Harbor; switched off/);
    expect(out.text).not.toContain("The Pier");
    expect((await run(tools, "search_lorebook", { words: "pier" })).text).toContain("[e2] The Pier (Harbor; always on)");
    const many = await run(tools, "search_lorebook", { words: "lamp" });
    expect(many.text.split("\n").filter((l) => l.startsWith("[e"))).toHaveLength(20);
    expect(many.text).toContain("5 more match");
    expect(many.detail).toMatchObject({ summary: 'searched the lore for "lamp" (20 found)' });
  });

  test("read_lorebook_entry reads one entry whole by its handle, with its words; an unknown handle is refused", async () => {
    const { tools } = await (await scene()).make();
    const out = await run(tools, "read_lorebook_entry", { handle: "e3" });
    expect(out.text).toContain("## Old Bell (Harbor)");
    expect(out.text).toContain("Rings for a sister lost.");
    expect(out.text).toContain("bell");
    expect(out.detail).toMatchObject({ summary: 'read the lore entry "Old Bell"' });
    expect((await run(tools, "read_lorebook_entry", { handle: "e99" })).error).toContain("e99");
    expect((await run(tools, "read_lorebook_entry", { handle: "Mira" })).error).toContain("handle");
  });

  test("read_preset_block by name or identifier, whole, and whether it is on", async () => {
    const { tools } = await (await scene()).make();
    expect((await run(tools, "read_preset_block", { name: "terse" })).text).toContain("### Terse Mode [terse] (off in this scene)\nShort replies only.");
    const byName = await run(tools, "read_preset_block", { name: "main prompt" });
    expect(byName.text).toContain("(on in this scene)");
    expect(byName.detail).toMatchObject({ summary: 'read the preset block "Main Prompt"' });
    expect((await run(tools, "read_preset_block", { name: "nope" })).error).toContain("Main Prompt, Terse Mode");
  });
});

describe("through the narrator loop", () => {
    test("a full list page and a full read page reach the model whole, their paging line included", async () => {
    const { tools } = await (await scene(Array.from({ length: 150 }, (_, i) => `m${i + 1} ${"y".repeat(400)}`))).make();
    const records: ToolCallRecord[] = [];
    const script = [
      { content: "", tool_calls: [{ id: "a", type: "function" as const, function: { name: "list_scene_messages", arguments: "{}" } }, { id: "b", type: "function" as const, function: { name: "read_scene_messages", arguments: '{"from":1,"to":150}' } }], raw: {} },
      { content: "done", raw: {} },
    ];
    const provider: Provider = { id: "p", send: async () => script.shift()! };
    await sendWithTools(provider, { model: "m", messages: [], options: {} }, {}, { tools, maxRounds: 8, now: () => 1, onCall: (r) => void records.push(r) });
    for (const r of records) {
      expect(r.ok).toBe(true);
      expect(r.text).not.toContain("[cut:");
      expect(r.text).toMatch(/next_from: \d+/);
    }
    const listed = records[0]!.text.split("\n").filter((l) => l.startsWith("#"));
    expect(listed.length).toBeGreaterThan(50);
    expect(listed.every((l) => l.length < 140)).toBe(true);
    expect(records[0]!.text).toContain(`next_from: ${listed.length + 1}`);
    expect(records[0]!.text).toContain(`#1 to #${listed.length}:`);
  });
});

describe("readSummary", () => {
  test("the call's own line when it ran, the refusal when it did not, at most 300 characters", () => {
    const rec = (over: Partial<ToolCallRecord>): ToolCallRecord => ({ round: 1, id: "c", name: "read_scene_messages", args: "{}", ok: true, ms: 1, text: "", ...over });
    expect(readSummary(rec({ detail: { summary: "read messages #1 to #4" } }))).toBe("read messages #1 to #4");
    expect(readSummary(rec({ ok: false, error: "from is required" }))).toBe("read_scene_messages was refused: from is required");
    expect(readSummary(rec({ ok: false, error: "x".repeat(900) })).length).toBe(300);
  });
});
