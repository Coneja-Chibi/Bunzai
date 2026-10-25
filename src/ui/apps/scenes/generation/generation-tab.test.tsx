/**
 * The Generation tab (generation-tab.tsx) as it mounts. Core is the scene's own sampler overrides, so each
 * test drives the tab and reads the result through the OTHER writer's reader (the Control Booth's sampler
 * bar), against one stateful fake store. Typing and slider drags are not simulated by the DOM harness; the
 * handler React attached is called directly (the technique scene-booth-wing.test.tsx documents).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../../app-contract";
import type { PresetBody } from "../../../../entities/preset/schema";
import type { Chat, ChatPreset } from "../../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../../studio/scenes";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";


let dom: JSDOM;
let installed: InstalledDom;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8325/", pretendToBeVisual: true,
    extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "SVGElement", "Event", "CustomEvent", "sessionStorage"],
    boundGlobals: ["getComputedStyle"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) },
  });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const presetBody: PresetBody = { name: "Test Preset", prompts: [], groups: [], samplers: { temperature: 0.7, topP: 0.9 } };
const cast = { character: { id: "c1", version: 1, name: "Char" } } as Chat["cast"];
const chatWith = (over: Partial<Chat> = {}): Chat => ({ id: "chat1", title: "Scene", cast, activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 1, connection: { id: "k1", model: "m" }, ...over });
const withOwn = (samplers: ChatPreset["samplers"]): Chat => chatWith({ preset: { id: "p1", toggles: {}, samplers } });

let sets: ChatPreset[];
let patches: Record<string, unknown>[];
/** While true a prompting write never answers, so the tab keeps showing the change it is still saving. */
let hold = false;
let changed: Chat[];
let root: Root;
let host: HTMLElement;
type FlushSync = typeof import("react-dom")["flushSync"];

beforeEach(() => { installed.reinstall(); sets = []; patches = []; changed = []; hold = false; });

const makeCtx = (): AppContext => ({
  api: {
    getEditableEntity: async () => ({ entity: { kind: "preset", id: "p1", body: presetBody }, revision: "r1" }),
    setScenePreset: async (_chatId: string, preset: ChatPreset | null) => { if (preset) sets.push(preset); return chatWith(preset ? { preset } : {}); },
    setScenePrompting: async (_chatId: string, patch: Record<string, unknown>) => { patches.push(patch); return hold ? new Promise<Chat>(() => undefined) : chatWith(); },
    sceneConnections: async () => [{ id: "k1", label: "Harbor", kind: "openai", model: "m" }],
    connectionModels: async () => ({ models: [{ id: "m", context: 200_000 }], saved: "m" }),
    getSceneLore: async () => ({ books: [], lastTurn: null }), listLoadouts: async () => [], latestLoadoutReceipt: async () => null, getSceneTrace: async () => null, getSceneSummary: async () => ({ settings: {}, text: null, through: 0, at: null, total: 0, error: null, running: false }),
  },
  setStatus: () => undefined, prefs: { get: () => undefined, set: () => undefined }, workbench: { open: () => undefined }, openApp: () => undefined,
} as unknown as AppContext);

async function settle(flushSync: FlushSync, ms = 20): Promise<void> { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); }

async function mount(node: () => JSX.Element): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(node()));
  await settle(flushSync);
  return flushSync;
}
const mountTab = async (chat: Chat): Promise<FlushSync> => {
  const { GenerationTab } = await import("./generation-tab");
  return mount(() => <GenerationTab ctx={makeCtx()} chat={chat} onChat={(c) => changed.push(c)} />);
};
const unmount = (flushSync: FlushSync): void => { flushSync(() => root.unmount()); host.remove(); };
const propsOf = (el: Element): Record<string, (e: unknown) => void> => (el as unknown as Record<string, Record<string, (e: unknown) => void>>)[Object.keys(el).find((k) => k.startsWith("__reactProps$"))!]!;
const type = (el: Element, value: string): void => propsOf(el).onChange!({ target: { value } });
const card = (id: string): Element => host.querySelector(`[data-param="${id}"]`)!;
const text = (): string => host.textContent ?? "";
const byText = (sel: string, t: string): HTMLElement | undefined => [...host.querySelectorAll<HTMLElement>(sel)].find((e) => (e.textContent ?? "").includes(t));

describe("Generation shell", () => {
  test("RoleCall's hero, the count with Reset, the search and the Core group from the preset", async () => {
    const flushSync = await mountTab(withOwn({}));
    expect(text()).toContain("Narrator output controls");
    expect(text()).toContain("How long, how adventurous and how carefully the AI writes. Core values come from your preset; turn on any other parameter your model supports, and anything left off uses the provider default.");
    expect(text()).toContain("0 parameters enabled");
    expect(host.querySelector('input[aria-label="Search parameters by name, description, or alias"]')).not.toBeNull();
    expect(text()).toContain("Core");
    expect(text()).toContain("from preset");
    expect(text()).toContain("Same values as Prompting > Preset and the Control Booth. Changing one here changes it there.");
    expect([...host.querySelectorAll(".gn-grp [data-param], .gn-box [data-param]")].map((c) => c.getAttribute("data-param"))).toEqual(["temperature", "top_p", "top_k", "max_tokens", "reasoning_effort", "roundtrip_native_reasoning", "keep_inline_thinking_tags"]);
    expect(host.querySelector('[data-param="temperature"] .gn-rv b')?.textContent).toBe("0.70");
    expect(host.querySelector('[data-param="temperature"] .gn-key')?.textContent).toBe("temperature");
    expect(host.querySelectorAll(".gn-foot")[0]?.textContent).toBe("From preset");
    expect(host.querySelectorAll(".gn-foot")[2]?.textContent).toContain("Not set");
    expect(text()).toContain("Two kinds of thinking in Bunraku.");
    unmount(flushSync);
  });

  test("a scene with no preset has nothing to set and says where to start", async () => {
    const flushSync = await mountTab(chatWith());
    expect(text()).toContain("Core values belong to the scene's preset. Choose one in Prompting.");
    expect([...host.querySelectorAll(".gn-grp [data-param], .gn-box [data-param]")].map((c) => c.getAttribute("data-param"))).toEqual(["reasoning_effort", "roundtrip_native_reasoning", "keep_inline_thinking_tags"]);
    unmount(flushSync);
  });
});

describe("Core is the scene's one sampler store", () => {
  test("a Core edit is the write the Booth makes, and the Booth reads it back", async () => {
    let flushSync = await mountTab(withOwn({}));
    type(card("temperature").querySelector("input[type=range]")!, "1.3");
    await settle(flushSync, 400);
    expect(sets.at(-1)?.samplers).toEqual({ temperature: 1.3 });
    unmount(flushSync);
    const { BoothWing } = await import("../scene-booth-wing");
    const scene = { chat: withOwn(sets.at(-1)!.samplers), messages: [], messageCount: 0, snapshot: {} } as unknown as OpenScene;
    flushSync = await mount(() => <BoothWing ctx={makeCtx()} scene={scene} busy={false} art={<span />} onChat={() => undefined} onSettings={() => undefined} onOpen={() => undefined} />);
    // The Booth draws its sliders open (RoleCall's Generation (Quick)): Temperature's card reads the value the Generation tab wrote.
    const tempCard = [...host.querySelectorAll(".sl")].find((c) => c.querySelector(".slh span")?.textContent === "Temperature");
    expect(tempCard?.querySelector(".slv")?.textContent).toBe("1.30");
    unmount(flushSync);
  });

  test("a value the Booth or Prompting wing set shows here as changed for this chat, with a reset to the preset", async () => {
    const flushSync = await mountTab(withOwn({ topK: 40, temperature: 1.4 }));
    expect(text()).toContain("2/4 changed for this chat");
    expect((card("top_k").querySelector("input[type=number]") as HTMLInputElement).value).toBe("40");
    expect(byText(".gn-foot", "Changed for this chat")).toBeDefined();
    flushSync(() => (byText(".gn-foot button", "Reset to preset") as HTMLButtonElement).click());
    await settle(flushSync, 400);
    expect(sets.at(-1)?.samplers).toEqual({ topK: 40 });
    unmount(flushSync);
  });

  test("two edits in the same tick both land: the second is made on top of the first", async () => {
    const flushSync = await mountTab(withOwn({}));
    type(card("temperature").querySelector("input[type=range]")!, "1.1");
    type(card("top_k").querySelector("input[type=number]")!, "50");
    await settle(flushSync, 400);
    expect(sets.at(-1)?.samplers).toEqual({ temperature: 1.1, topK: 50 });
    unmount(flushSync);
  });

  test("Reset clears the Core overrides and every switched-on parameter back to the preset and keeps the scene's other settings and the toggles", async () => {
    const chat = chatWith({ preset: { id: "p1", toggles: { a: true }, samplers: { temperature: 1.3, topP: 0.5, topK: 40, maxTokens: 900, maxContext: 9000, frequencyPenalty: 0.5 } } });
    const flushSync = await mountTab(chat);
    flushSync(() => (byText("button", "Reset") as HTMLButtonElement).click());
    await settle(flushSync, 400);
    expect(sets.at(-1)).toEqual({ id: "p1", toggles: { a: true }, samplers: { maxContext: 9000 } });
    unmount(flushSync);
  });
});

describe("Search", () => {
  test("finds a card by its alias, shows only matches flat, and hides the callout while it is typed", async () => {
    const flushSync = await mountTab(withOwn({}));
    flushSync(() => type(host.querySelector('input[type="text"]')!, "top_p"));
    expect([...host.querySelectorAll(".gn-grp [data-param], .gn-box [data-param]")].map((c) => c.getAttribute("data-param"))).toEqual(["top_p"]);
    expect(text()).toContain("1 found");
    expect(text()).not.toContain("Two kinds of thinking");
    flushSync(() => type(host.querySelector('input[type="text"]')!, "zzzz"));
    expect(text()).toContain('No parameters match "zzzz".');
    flushSync(() => (host.querySelector('button[aria-label="Clear search"]') as HTMLButtonElement).click());
    expect(host.querySelectorAll(".gn-grp [data-param], .gn-box [data-param]").length).toBe(7);
    unmount(flushSync);
  });
});

const withPrompting = (prompting: NonNullable<Chat["prompting"]>, model = "m"): Chat => chatWith({ preset: { id: "p1", toggles: {}, samplers: {} }, prompting, connection: { id: "k1", model } });
const select = (): HTMLSelectElement => host.querySelector("[data-param=reasoning_effort] select") as HTMLSelectElement;
const button = (label: string): HTMLButtonElement => byText("button", label) as HTMLButtonElement;

describe("Reasoning", () => {
  test("RoleCall's card: the effort select with its seven levels, Auto until one is chosen, no continuity switch", async () => {
    const flushSync = await mountTab(withOwn({}));
    expect(text()).toContain("Provider-native reasoning");
    expect(select().value).toBe("auto");
    expect([...select().options].map((o) => o.value)).toEqual(["auto", "none", "minimal", "low", "medium", "high", "xhigh"]);
    expect(select().options[4]!.textContent).toBe("Medium - Balanced reasoning (~25% of max_tokens)");
    expect(text()).toContain("Reasoning continuity");
    unmount(flushSync);
  });

  test("choosing a level is the scene's reasoningEffort, counts as one enabled parameter, and Auto clears it", async () => {
    hold = true;
    const flushSync = await mountTab(withOwn({}));
    flushSync(() => type(select(), "high"));
    await settle(flushSync, 5);
    expect(text()).toContain("1 parameter enabled");
    expect(patches.at(-1)).toEqual({ reasoningEffort: "high" });
    unmount(flushSync);
    hold = false;
    const again = await mountTab(withPrompting({ reasoningEffort: "high" }));
    flushSync(() => type(select(), "auto"));
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ reasoningEffort: null });
    unmount(again);
  });

  test("Reset puts the level back to Auto", async () => {
    const flushSync = await mountTab(withPrompting({ reasoningEffort: "medium" }));
    expect(select().value).toBe("medium");
    expect(text()).toContain("1 parameter enabled");
    flushSync(() => button("Reset").click());
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ reasoningEffort: null });
    unmount(flushSync);
  });

  test("a connection whose request builder ignores the level says so, and Search finds the card by name", async () => {
    let flushSync = await mountTab(withPrompting({ reasoningEffort: "high" }));
    await settle(flushSync);
    expect(text()).not.toContain("takes no reasoning level");
    unmount(flushSync);
    const ctx = makeCtx();
    (ctx.api as unknown as Record<string, unknown>)["sceneConnections"] = async () => [{ id: "k1", label: "Local", kind: "local", model: "m" }];
    const { GenerationTab } = await import("./generation-tab");
    flushSync = await mount(() => <GenerationTab ctx={ctx} chat={withPrompting({ reasoningEffort: "high" })} onChat={() => undefined} />);
    expect(text()).toContain("takes no reasoning level");
    flushSync(() => type(host.querySelector('input[type="text"]')!, "effort"));
    expect([...host.querySelectorAll(".gn-grp [data-param], .gn-box [data-param]")].map((c) => c.getAttribute("data-param"))).toEqual(["reasoning_effort"]);
    unmount(flushSync);
  });
});

describe("Thinking in Replies", () => {
  test("RoleCall's card: Start Reply With with its three roles, the common shapes and Catch thinking on Auto", async () => {
    const flushSync = await mountTab(withOwn({}));
    expect(text()).toContain("Start Reply With");
    expect(text()).toContain("Assistant Prefill");
    expect(text()).toContain("Text every reply starts with.");
    expect([...host.querySelectorAll('[aria-label="Prefill role"] button')].map((b) => b.textContent)).toEqual(["assistant", "user", "system"]);
    expect(button("Auto").getAttribute("aria-checked")).toBe("true");
    expect(text()).toContain("Auto: catches your Start Reply With tag");
    expect(text()).toContain("Let the model see its old thinking");
    expect(text()).toContain("Show Prefill in Chat");
    unmount(flushSync);
  });

  test("typing the Start Reply With text saves it once the typing rests, and a role is its own write", async () => {
    const flushSync = await mountTab(withOwn({}));
    const input = host.querySelector("#gn-prefill")!;
    flushSync(() => type(input, "<think>"));
    expect(patches).toEqual([]);
    await settle(flushSync, 500);
    expect(patches).toEqual([{ prefill: "<think>" }]);
    flushSync(() => button("user").click());
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ prefillRole: "user" });
    flushSync(() => button("assistant").click());
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ prefillRole: null });
    flushSync(() => button("<plan>").click());
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ prefill: "<plan>" });
    unmount(flushSync);
  });

  test("a model that refuses an assistant prefill gets RoleCall's warning with its two ways out; others do not", async () => {
    let flushSync = await mountTab(withPrompting({ prefill: "<think>" }, "claude-opus-4-6"));
    expect(text()).toContain("Claude 4.6+ cannot continue an assistant prefill.");
    expect(text()).toContain("Bunraku will ignore any chat or preset Start Reply With text for this model.");
    flushSync(() => button("Send as user message").click());
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ prefillRole: "user" });
    unmount(flushSync);
    flushSync = await mountTab(withPrompting({ prefill: "<think>" }, "gpt-5"));
    expect(text()).not.toContain("cannot continue an assistant prefill");
    unmount(flushSync);
  });

  test("Catch thinking: Only these seeds the Start Reply With tag and the common three, keeps its lists across modes, and Off is one write", async () => {
    const flushSync = await mountTab(withPrompting({ prefill: "<plan>" }));
    flushSync(() => button("Only these").click());
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ capture: { mode: "only", custom: [{ open: "<plan>", close: "</plan>" }], builtinTags: ["<think>", "<thinking>", "<thought>"] } });
    unmount(flushSync);
    const kept = { mode: "only" as const, custom: [{ open: "Status:", close: "---" }], builtinTags: ["<plan>"] };
    const again = await mountTab(withPrompting({ capture: kept }));
    expect(text()).toContain("Your own tags");
    expect(text()).toContain("1 of 41 picked");
    flushSync(() => button("Auto").click());
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ capture: { ...kept, mode: "auto" } });
    flushSync(() => button("Off").click());
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ capture: { ...kept, mode: "off" } });
    unmount(again);
  });

  test("Search hides the callout and Thinking in Replies, as RoleCall does", async () => {
    const flushSync = await mountTab(withOwn({}));
    flushSync(() => type(host.querySelector('input[type="text"]')!, "temp"));
    expect(text()).not.toContain("Start Reply With");
    unmount(flushSync);
  });
});

describe("the thinking switches RoleCall has, each read by something", () => {
  const card = (id: string): Element => host.querySelector(`[data-param="${id}"]`)!;
  const switchOf = (el: Element): HTMLButtonElement => el.querySelector("button[role=switch]") as HTMLButtonElement;

  test("Let the model see its old thinking is the scene's keepThinking, off by default", async () => {
    const flushSync = await mountTab(withOwn({}));
    expect(switchOf(card("keep_inline_thinking_tags")).getAttribute("aria-checked")).toBe("false");
    flushSync(() => switchOf(card("keep_inline_thinking_tags")).click());
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ keepThinking: true });
    unmount(flushSync);
    const on = await mountTab(withPrompting({ keepThinking: true }));
    expect(switchOf(card("keep_inline_thinking_tags")).getAttribute("aria-checked")).toBe("true");
    flushSync(() => switchOf(card("keep_inline_thinking_tags")).click());
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ keepThinking: null });
    unmount(on);
  });

  test("Show Prefill in Chat is the scene's showPrefill", async () => {
    const flushSync = await mountTab(withOwn({}));
    const sw = host.querySelector('button[aria-label="Show Prefill in Chat"]') as HTMLButtonElement;
    expect(sw.getAttribute("aria-checked")).toBe("false");
    flushSync(() => sw.click());
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ showPrefill: true });
    unmount(flushSync);
  });

  test("Reasoning continuity (advanced) is the scene's continuity and says it is Anthropic's alone", async () => {
    const flushSync = await mountTab(withOwn({}));
    expect(text()).toContain("(advanced)");
    flushSync(() => switchOf(card("roundtrip_native_reasoning")).click());
    await settle(flushSync, 5);
    expect(patches.at(-1)).toEqual({ continuity: true });
    unmount(flushSync);
  });
});

describe("the AI wing mounts it", () => {
  test("the Generation card of the AI wing opens this tab", async () => {
    const { AiTabs } = await import("../scene-ai-tabs");
    const { GenerationTab } = await import("./generation-tab");
    const flushSync = await mount(() => <AiTabs model={<span>model tab</span>} generation={<GenerationTab ctx={makeCtx()} chat={withOwn({})} onChat={() => undefined} />} />);
    expect(text()).not.toContain("Narrator output controls");
    flushSync(() => button("Generation").click());
    await settle(flushSync);
    expect(text()).toContain("Narrator output controls");
    unmount(flushSync);
  });
});

describe("the parameter catalogue is mounted on the tab", () => {
  const withParams = (params: NonNullable<ChatPreset["samplers"]["params"]>, prompting?: NonNullable<Chat["prompting"]>): Chat => chatWith({ preset: { id: "p1", toggles: {}, samplers: { params } }, ...(prompting ? { prompting } : {}) });

  test("its groups follow Thinking in Replies, with Custom Request Parameters and the note, and their count is the tab's", async () => {
    const flushSync = await mountTab(withParams({ min_p: { on: true, value: 0.1 }, seed: { on: true, value: 1 } }));
    expect(text()).toContain("Nucleus Sampling");
    expect(text()).toContain("Repetition Penalties");
    expect(text()).toContain("Custom Request Parameters");
    expect(text()).toContain("Enable parameters to send them to your AI provider.");
    expect(text().indexOf("Thinking in Replies")).toBeLessThan(text().indexOf("Nucleus Sampling"));
    expect(text()).toContain("2 parameters enabled");
    unmount(flushSync);
  });

  test("a switch is a write through the one preset writer, and Reset switches every parameter off again", async () => {
    const flushSync = await mountTab(withParams({ seed: { on: true, value: 1 } }));
    flushSync(() => (byText("button", "Reset") as HTMLButtonElement).click());
    await settle(flushSync, 400);
    expect(sets.at(-1)?.samplers).toEqual({});
    unmount(flushSync);
  });

  test("Search reaches them by name or alias, flat, and hides Custom Request Parameters while it is typed", async () => {
    const flushSync = await mountTab(withParams({}));
    flushSync(() => type(host.querySelector('input[type="text"]')!, "mirostat"));
    expect(text()).toContain("found");
    expect([...host.querySelectorAll(".gp-card")].every((c) => (c.textContent ?? "").toLowerCase().includes("mirostat"))).toBe(true);
    expect(text()).not.toContain("Custom Request Parameters");
    unmount(flushSync);
  });

  test("Clear Thinking hangs from Enable Thinking, which is on while Reasoning Effort is a level", async () => {
    const clear = (): Element => host.querySelector('[data-param="clear_thinking"]')!;
    let flushSync = await mountTab(withParams({}));
    flushSync(() => type(host.querySelector('input[type="text"]')!, "clear thinking"));
    expect(clear().className).toContain("greyed");
    unmount(flushSync);
    flushSync = await mountTab(withParams({}, { reasoningEffort: "high" }));
    flushSync(() => type(host.querySelector('input[type="text"]')!, "clear thinking"));
    expect(clear().className).not.toContain("greyed");
    unmount(flushSync);
  });
});
