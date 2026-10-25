/** Lore & state (rc-parity 08): the assembly header, the Context Pressure meter and the State, Lore, Sources, Flow and Compose tabs, all over one trace and the stores' variables. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom, flushTasks } from "../../../_shared/test-dom";
import type { AppContext } from "../../../app-contract";
import type { SceneTrace, SceneVariables, VariableHistory } from "../../../app-contract-scenes";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { TraceState } from "./use-reply-trace";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["MouseEvent", "Event", "InputEvent"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const trace = (over: Partial<SceneTrace> = {}): SceneTrace => ({
  reply: { messageId: "m3", swipeId: "s3", number: 6, model: "vera-1", take: "Director's Cut" },
  blocks: [
    { kind: "prompt", label: "Main Prompt", role: "system", tokens: 50, category: "preset", text: "You are Vera." },
    { kind: "prompt", label: "Character Description", role: "system", tokens: 100, category: "character", text: "Tall." },
    { kind: "lore", label: "Mira", role: "system", tokens: 25, category: "lore", text: "Mira keeps the lighthouse." },
    { kind: "history", label: "Message 5", role: "user", tokens: 20, category: "history", text: "Hi" },
    { kind: "current", label: "Message 6", role: "user", tokens: 5, category: "current", text: "Storms?" },
  ],
  window: { context: 1000, reply: 100, stated: true },
  trimmed: 0,
  lore: {
    injected: [
      { bookId: "b1", entryId: "e1", bookName: "The Book", title: "Mira", reason: "key", matched: ["mira"], tokens: 25, place: "World", loop: 0 },
      { bookId: "b1", entryId: "e2", bookName: "The Book", title: "Lamp", reason: "recursion", matched: ["lamp"], tokens: 9, place: "Scene", loop: 1 },
    ],
    cut: [{ bookId: "b1", entryId: "e3", bookName: "The Book", title: "Tide", reason: "key", matched: ["tide"], tokens: 80, place: "World", loop: 0 }],
    missed: [{ bookId: "b1", entryId: "e4", bookName: "The Book", title: "Rain", reason: "cooldown", why: "cooling down: 2 turns left" }],
    chains: [{ from: "Mira", to: "Lamp", keyword: "lamp" }], totalTokens: 34, share: 250, seed: 1,
  },
  rawAvailable: true,
  replies: [{ messageId: "m3", swipeId: "s3", number: 6 }],
  ...over,
});

const vars: SceneVariables = {
  local: [
    { key: "mood", value: "calm", createdAt: 1, updatedAt: 2 },
    { key: "_arc_chapter", value: 2, createdAt: 1, updatedAt: 2 },
    { key: "_char_vera_trust", value: { n: 3 }, createdAt: 1, updatedAt: 2 },
    { key: "__once_fired", value: true, createdAt: 1, updatedAt: 2 },
  ],
  global: [{ key: "gold", value: 40, createdAt: 1, updatedAt: 2 }],
};

const saved = new Map<string, unknown>();
const chat = { id: "c1", updatedAt: 1 } as unknown as Chat;

async function mount(state: TraceState, api: Partial<{ getSceneVariables(id: string): Promise<SceneVariables>; getSceneVariableHistory(id: string, scope: string, key: string): Promise<VariableHistory> }> = {}): Promise<{ host: HTMLElement; done(): void }> {
  const [{ flushSync }, { createRoot }, { LoreState }] = await Promise.all([import("react-dom"), import("react-dom/client"), import("./lore-state")]);
  const ctx = { api: { getSceneVariables: api.getSceneVariables ?? (async () => vars), getSceneVariableHistory: api.getSceneVariableHistory ?? (async () => ({ entries: [], truncated: false })) }, prefs: { get: (k: string) => saved.get(k), set: (k: string, v: unknown) => { saved.set(k, v); } } } as unknown as AppContext;
  const el = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(el);
  const root = createRoot(el);
  flushSync(() => root.render(<LoreState ctx={ctx} chat={chat} state={state} />));
  await settle();
  return { host: el, done: () => flushSync(() => root.unmount()) };
}
const settle = async (): Promise<void> => { const { flushSync } = await import("react-dom"); await flushTasks(); flushSync(() => undefined); };
const ready = (t: SceneTrace | null): TraceState => ({ state: "ready", trace: t });
const click = async (el: Element | null | undefined): Promise<void> => { const { flushSync } = await import("react-dom"); flushSync(() => (el as HTMLElement).click()); await settle(); };
const tab = (host: HTMLElement, label: string): HTMLElement => [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((b) => b.textContent === label)!;
const type = async (input: HTMLInputElement, value: string): Promise<void> => {
  const { flushSync } = await import("react-dom");
  const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
  flushSync(() => { set.call(input, value); input.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
};

describe("Lore & state", () => {
  test("before any reply only State shows, with RoleCall's sentence", async () => {
    const m = await mount(ready(null));
    expect(m.host.querySelector('[role="tablist"]')).toBeNull();
    expect(m.host.textContent).toContain("Variables");
    expect(m.host.textContent).toContain("Lore, macros, sources and the prompt layout appear here after you send a message.");
    m.done();
  });
  test("after a reply: the assembly line counts the assembler's tokens, estimated until the provider reports, then 'estimate -> actual'", async () => {
    let m = await mount(ready(trace()));
    expect(m.host.querySelector(".ls-top h3")?.textContent).toBe("Last captured assembly");
    expect(m.host.querySelector(".ls-top p")?.textContent).toBe("2 msgs • ~200 tokens (est.)");
    m.done();
    m = await mount(ready(trace({ turn: { sent: 230, back: 40, exact: true, at: 1 } })));
    expect(m.host.querySelector(".ls-top p")?.textContent).toBe("2 msgs • ~200 → 230 tokens");
    m.done();
  });
  test("paging This turn back to an older reply relabels the assembly instead of calling it the last", async () => {
    const m = await mount(ready(trace({ replies: [{ messageId: "m9", swipeId: "s9", number: 8 }, { messageId: "m3", swipeId: "s3", number: 6 }] })));
    expect(m.host.querySelector(".ls-top h3")?.textContent).toBe("Assembly of reply #6");
    m.done();
  });
  test("the tabs are State, Lore, Macros, Sources, Flow and Compose, State first", async () => {
    const m = await mount(ready(trace()));
    expect([...m.host.querySelectorAll('[aria-label="Lore and state"] [role="tab"]')].map((b) => b.textContent)).toEqual(["State", "Lore", "Macros", "Sources", "Flow", "Compose"]);
    expect(tab(m.host, "State").getAttribute("aria-selected")).toBe("true");
    m.done();
  });
});

describe("Context Pressure", () => {
  test("reads the window from the trace: percent, '~estimate -> actual / limit', and what is left after the reply's reserve", async () => {
    const m = await mount(ready(trace({ turn: { sent: 230, back: 40, exact: true, at: 1 } })));
    const ps = m.host.querySelector(".ps")!;
    expect(ps.textContent).toContain("Context Pressure");
    expect(ps.querySelector(".ps-pct")?.textContent).toBe("23%");
    expect(ps.querySelector(".ps-stats")?.textContent).toContain("~200 → 230 / 1,000");
    expect(ps.querySelector(".ps-stats")?.textContent).toContain("670 remaining");
    m.done();
  });
  test("a window the connection did not state says so, and its level is capped at warning", async () => {
    const m = await mount(ready(trace({ window: { context: 200, reply: 20, stated: false } })));
    expect(m.host.querySelector(".ps")!.classList.contains("warning")).toBe(true);
    expect(m.host.querySelector(".ps-note")?.textContent).toContain("Context limit not stated by this model");
    m.done();
  });
  test("the gear opens the thresholds and the Context Target; both are saved as the viewer's prefs and the target replaces the window", async () => {
    saved.clear();
    const m = await mount(ready(trace()));
    await click(m.host.querySelector('[aria-label="Thresholds"]')!);
    await type(m.host.querySelector('[aria-label="Warning threshold"]') as HTMLInputElement, "40");
    expect(saved.get("context.thresholds")).toMatchObject({ warning: 40, danger: 85, critical: 95 });
    await type(m.host.querySelector('[aria-label="Context Target"]') as HTMLInputElement, "1");
    expect(saved.get("context.target")).toBeUndefined();
    await type(m.host.querySelector('[aria-label="Context Target"]') as HTMLInputElement, "4096");
    expect(saved.get("context.target")).toBe(4096);
    expect(m.host.querySelector(".ps-watch")?.textContent).toBe("Watching 4,096 tokens instead of this model's window");
    expect(m.host.querySelector(".ps-pct")?.textContent).toBe("5%");
    m.done();
  });
});

describe("Sources, Flow and Compose", () => {
  test("Sources groups the request by what each block is with its share; pointing at one opens Compose on it, lit", async () => {
    const m = await mount(ready(trace()));
    await click(tab(m.host, "Sources"));
    expect([...m.host.querySelectorAll(".ls-node .ls-name")].map((n) => n.textContent)).toEqual(["Preset prompts1 block", "Character card1 block", "Lore1 block", "Chat history1 block", "Current message1 block"]);
    expect(m.host.textContent).toContain("200 total tokens");
    await click(m.host.querySelector('[aria-label="Highlight Lore in Compose"]')!);
    expect(tab(m.host, "Compose").getAttribute("aria-selected")).toBe("true");
    expect(m.host.querySelectorAll(".ls-sec.lit")).toHaveLength(1);
    expect(m.host.textContent).toContain("Mira keeps the lighthouse.");
    await click(m.host.querySelector(".ls-chip")!);
    expect(m.host.querySelectorAll(".ls-sec.lit")).toHaveLength(0);
    m.done();
  });
  test("Flow ranks the sources, largest first", async () => {
    const m = await mount(ready(trace()));
    await click(tab(m.host, "Flow"));
    expect([...m.host.querySelectorAll(".ls-flow > div:first-child")].map((d) => d.textContent)).toEqual(["Character card100 (50%)", "Preset prompts50 (25%)", "Lore25 (13%)", "Chat history20 (10%)", "Current message5 (3%)"]);
    m.done();
  });
  test("Compose lists the request in send order and a block opens to its text; with no text kept it says sizes only", async () => {
    let m = await mount(ready(trace()));
    await click(tab(m.host, "Compose"));
    expect(m.host.querySelectorAll(".ls-sec")).toHaveLength(5);
    expect(m.host.textContent).toContain("5 sections");
    await click(m.host.querySelector(".ls-sec .ls-node")!);
    expect(m.host.textContent).toContain("You are Vera.");
    m.done();
    m = await mount(ready(trace({ rawAvailable: false, blocks: [{ kind: "prompt", label: "Main Prompt", role: "system", tokens: 50, category: "preset" }] })));
    await click(tab(m.host, "Compose"));
    await click(m.host.querySelector(".ls-sec .ls-node")!);
    expect(m.host.textContent).toContain("Raw text is kept for each take's latest reply; this one shows sizes only.");
    m.done();
  });
});

describe("Lore", () => {
  test("entries by book with their reasons, the ones cut for space, and a Didn't fire list that opens", async () => {
    const m = await mount(ready(trace()));
    await click(tab(m.host, "Lore"));
    const text = m.host.textContent ?? "";
    expect(text).toContain("The Book");
    expect(text).toContain("KEY: \"mira\"");
    expect(text).toContain("WOKEN BY: Mira (loop 1)");
    expect(text).toContain("Left out for space");
    expect(text).toContain("Tide");
    expect(text).toContain("2 entries");
    expect(text).not.toContain("cooling down: 2 turns left");
    await click([...m.host.querySelectorAll("button")].find((b) => b.textContent?.includes("Didn't fire (1)")));
    expect(m.host.textContent).toContain("cooling down: 2 turns left");
    m.done();
  });
  test("search narrows by title or matched key, and says so when nothing matches", async () => {
    const m = await mount(ready(trace()));
    await click(tab(m.host, "Lore"));
    await type(m.host.querySelector('[aria-label="Search entries"]') as HTMLInputElement, "lamp");
    expect(m.host.textContent).toContain("Lamp");
    expect(m.host.querySelectorAll(".ls-node.lore")).toHaveLength(1);
    await type(m.host.querySelector('[aria-label="Search entries"]') as HTMLInputElement, "zzz");
    expect(m.host.textContent).toContain("No matching entries");
    m.done();
  });
  test("a reply no lorebook touched says so in RoleCall's words", async () => {
    const m = await mount(ready(trace({ lore: null })));
    await click(tab(m.host, "Lore"));
    expect(m.host.textContent).toContain("No lorebook entries active");
    m.done();
  });
});

describe("State", () => {
  test("variables by scope with counts, the engine's own hidden until asked for, a row opening to its value", async () => {
    const m = await mount(ready(trace()));
    const chips = [...m.host.querySelectorAll(".ls-chips button")].map((b) => b.textContent);
    expect(chips).toEqual(["session 1", "character 1", "arc 1", "scene 0", "global 1", "internal 1"]);
    expect([...m.host.querySelectorAll(".ls-var code")].map((c) => c.textContent)).toEqual(["mood", "trust", "chapter", "gold"]);
    await click([...m.host.querySelectorAll<HTMLElement>(".ls-chips button")].find((b) => b.textContent === "internal 1"));
    expect([...m.host.querySelectorAll(".ls-var code")].map((c) => c.textContent)).toContain("__once_fired");
    await click([...m.host.querySelectorAll(".ls-var")].find((b) => b.textContent?.includes("trust")));
    expect(m.host.textContent).toContain("character: vera");
    expect(m.host.textContent).toContain("stored as _char_vera_trust");
    m.done();
  });
  test("search filters by key or value; a failed read says why; no variables is RoleCall's empty line", async () => {
    let m = await mount(ready(trace()));
    await type(m.host.querySelector('[aria-label="Search variables"]') as HTMLInputElement, "calm");
    expect([...m.host.querySelectorAll(".ls-var code")].map((c) => c.textContent)).toEqual(["mood"]);
    m.done();
    m = await mount(ready(trace()), { getSceneVariables: async () => { throw new Error("library locked"); } });
    expect(m.host.querySelector('[role="alert"]')?.textContent).toContain("library locked");
    m.done();
    m = await mount(ready(null), { getSceneVariables: async () => ({ local: [], global: [] }) });
    expect(m.host.textContent).toContain("No variables set yet");
    m.done();
  });
});

const macros = {
  total: 6,
  used: [
    { name: "char", count: 3, tokens: 3, example: "{{char}}", value: "Vera" },
    { name: "description", count: 1, tokens: 40, example: "{{description}}", value: "Tall, keeps the light." },
  ],
  errors: [{ macro: "{{nope}}", message: "unknown macro" }],
  mutations: [{ scope: "local" as const, key: "mood", value: "wary", cause: "setvar" }],
};

describe("Macros", () => {
  test("the tiles, the hotspots first with their uses and tokens, and the failures listed", async () => {
    const m = await mount(ready(trace({ macros })));
    await click(tab(m.host, "Macros"));
    expect([...m.host.querySelectorAll(".ls-sum > div")].map((d) => d.textContent)).toEqual(["6Macros", "43Tokens Added", "1Errors"]);
    const rows = [...m.host.querySelectorAll(".ls-macro")].map((r) => r.textContent ?? "");
    expect(rows[0]).toContain("{{description}}");
    expect(rows[0]).toContain("+40 tok");
    expect(rows[1]).toContain("{{char}}");
    expect(rows[1]).toContain("x3");
    expect(m.host.querySelector(".ls-merr")?.textContent).toContain("{{nope}}");
    expect(m.host.querySelector(".ls-merr")?.textContent).toContain("unknown macro");
    m.done();
  });
  test("search narrows, and a row opens to what the macro produced", async () => {
    const m = await mount(ready(trace({ macros })));
    await click(tab(m.host, "Macros"));
    await type(m.host.querySelector('[aria-label="Search macros"]') as HTMLInputElement, "vera");
    expect([...m.host.querySelectorAll(".ls-macro")].length).toBe(1);
    await click(m.host.querySelector(".ls-macro"));
    expect(m.host.querySelector(".ls-body pre")?.textContent).toBe("Vera");
    await type(m.host.querySelector('[aria-label="Search macros"]') as HTMLInputElement, "zzz");
    expect(m.host.textContent).toContain("No macros match the search");
    m.done();
  });
  test("a reply from before macros were kept says so instead of showing zeros", async () => {
    const m = await mount(ready(trace()));
    await click(tab(m.host, "Macros"));
    expect(m.host.textContent).toContain("This reply was written before its macros were kept.");
    m.done();
  });
});

describe("State, after a reply", () => {
  test("Mutations Last Render and Macro Errors join the tiles and each opens its list", async () => {
    const m = await mount(ready(trace({ macros })));
    expect([...m.host.querySelectorAll(".ls-sum > div")].map((d) => d.textContent).slice(0, 3)).toEqual(["5Variables", "1Mutations Last Render", "1Macro Errors"]);
    await click(m.host.querySelector('[aria-label="Show Mutations Last Render"]'));
    expect(m.host.querySelector(".ls-mut")?.textContent).toContain("mood");
    expect(m.host.querySelector(".ls-mut")?.textContent).toContain("wary");
    expect(m.host.querySelector(".ls-mut")?.textContent).toContain("setvar");
    await click(m.host.querySelector('[aria-label="Show Macro Errors"]'));
    expect(m.host.querySelector(".ls-merr")?.textContent).toContain("unknown macro");
    m.done();
  });
  test("before any reply there are no such tiles", async () => {
    const m = await mount(ready(null));
    expect(m.host.textContent).not.toContain("Mutations Last Render");
    m.done();
  });
});

describe("a variable's history", () => {
  test("opening a variable lists its changes, newest first, asking by the stored key and its scope", async () => {
    const asked: string[][] = [];
    const m = await mount(ready(trace()), {
      getSceneVariableHistory: async (_id, scope, key) => { asked.push([scope, key]); return { truncated: false, entries: [{ number: 6, messageId: "m3", at: Date.UTC(2026, 9, 12), before: "calm", after: "wary" }, { number: 2, messageId: "m1", at: Date.UTC(2026, 9, 11), after: "calm" }] }; },
    });
    await click([...m.host.querySelectorAll(".ls-var")].find((b) => b.textContent?.includes("mood")));
    const rows = [...m.host.querySelectorAll(".ls-hist li")].map((r) => r.textContent ?? "");
    expect(rows[0]).toContain("#6");
    expect(rows[0]).toContain("calm → wary");
    expect(rows[1]).toContain("(not set) → calm");
    expect(asked).toEqual([["local", "mood"]]);
    await click([...m.host.querySelectorAll(".ls-var")].find((b) => b.textContent?.includes("gold")));
    expect(asked.at(-1)).toEqual(["global", "gold"]);
    m.done();
  });
  test("a deletion reads as one, no changes recorded says so, and a failed read says why", async () => {
    let m = await mount(ready(trace()), { getSceneVariableHistory: async () => ({ truncated: true, entries: [{ number: 8, messageId: "m", at: 1, before: "wary", deleted: true }] }) });
    await click([...m.host.querySelectorAll(".ls-var")].find((b) => b.textContent?.includes("mood")));
    expect(m.host.querySelector(".ls-hist li")?.textContent).toContain("wary → (deleted)");
    expect(m.host.textContent).toContain("Only the newest 400 replies were read.");
    m.done();
    m = await mount(ready(trace()), { getSceneVariableHistory: async () => ({ truncated: false, entries: [] }) });
    await click([...m.host.querySelectorAll(".ls-var")].find((b) => b.textContent?.includes("mood")));
    expect(m.host.textContent).toContain("No changes recorded for this variable in this take's replies.");
    m.done();
    m = await mount(ready(trace()), { getSceneVariableHistory: async () => { throw new Error("trace unreadable"); } });
    await click([...m.host.querySelectorAll(".ls-var")].find((b) => b.textContent?.includes("mood")));
    expect(m.host.textContent).toContain("trace unreadable");
    m.done();
  });
});
