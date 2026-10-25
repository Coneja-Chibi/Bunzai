/** The Memory tab (rc-parity 08): RoleCall's Chat Summary panel over the scene's summary settings and the take's text; each control writes its own key, once, and only when it changes something. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom, flushTasks } from "../../../_shared/test-dom";
import type { AppContext } from "../../../app-contract";
import type { ChatSummaryState } from "../../../app-contract-scenes";
import type { OpenScene } from "../../../../studio/scenes";
import { mergeSummarySettings } from "../../../../stage/store/summary-rules";
import type { SummarySettingsPatch } from "../../../../stage/contracts/chat-store";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["MouseEvent", "Event", "InputEvent", "HTMLDetailsElement"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const scene = { chat: { id: "c1", updatedAt: 1, activeBranchId: "b1", connection: { id: "conn", model: "anthropic/claude-sonnet-4" } }, snapshot: { character: { body: { identity: { name: "Vera" } } } } } as unknown as OpenScene;
const fresh = (over: Partial<ChatSummaryState> = {}): ChatSummaryState => ({ settings: {}, text: null, through: 0, at: null, total: 12, error: null, running: false, ...over });

/** A scene's summary in memory: the API the tab talks to, and what it was asked. */
function rig(start: ChatSummaryState, over: { backfill?: () => Promise<ChatSummaryState> } = {}) {
  let state = start;
  const log: { settings: SummarySettingsPatch[]; saved: string[]; backfills: number } = { settings: [], saved: [], backfills: 0 };
  const prefs = new Map<string, unknown>();
  const ctx = {
    api: {
      getSceneSummary: async () => state,
      setSceneSummarySettings: async (_c: string, patch: SummarySettingsPatch) => { log.settings.push(patch); state = { ...state, settings: mergeSummarySettings(state.settings, patch) ?? {} }; return state; },
      saveSceneSummary: async (_c: string, text: string) => { log.saved.push(text); if (text === "boom") throw new Error("The summary could not be saved."); state = { ...state, text, through: state.total, at: 9 }; return state; },
      backfillSceneSummary: async () => { log.backfills++; if (over.backfill) return over.backfill(); state = { ...state, text: "The whole story.", through: state.total, at: 10 }; return state; },
      sceneConnections: async () => [],
    },
    prefs: { get: (k: string) => prefs.get(k), set: (k: string, v: unknown) => { prefs.set(k, v); } },
  } as unknown as AppContext;
  return { ctx, log, prefs, now: () => state };
}

const settle = async (): Promise<void> => { const { flushSync } = await import("react-dom"); await flushTasks(); flushSync(() => undefined); };
async function mount(r: ReturnType<typeof rig>): Promise<{ host: HTMLElement; done(): void }> {
  const [{ flushSync }, { createRoot }, { MemoryTab }] = await Promise.all([import("react-dom"), import("react-dom/client"), import("./memory-tab")]);
  const el = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(el);
  const root = createRoot(el);
  flushSync(() => root.render(<MemoryTab ctx={r.ctx} scene={scene} onChat={() => undefined} />));
  await settle();
  return { host: el, done: () => flushSync(() => root.unmount()) };
}
const click = async (el: Element | null | undefined): Promise<void> => { const { flushSync } = await import("react-dom"); flushSync(() => (el as HTMLElement).click()); await settle(); };
const byText = (host: HTMLElement, sel: string, text: string): HTMLElement | undefined => [...host.querySelectorAll<HTMLElement>(sel)].find((e) => e.textContent?.includes(text));
const field = <T extends HTMLElement>(host: HTMLElement, label: string): T => host.querySelector<T>(`[aria-label="${label}"]`)!;
async function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string, leave = true): Promise<void> {
  const { flushSync } = await import("react-dom");
  const proto = el instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  flushSync(() => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
  if (leave) { flushSync(() => el.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }))); el.blur(); }
  await settle();
}
async function choose(el: HTMLSelectElement, value: string): Promise<void> {
  const { flushSync } = await import("react-dom");
  flushSync(() => { el.value = value; el.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  await settle();
}
const tiles = (host: HTMLElement): string[] => [...host.querySelectorAll(".mm-stats > div")].map((d) => d.textContent ?? "");

describe("the hero and the tiles", () => {
  test("a scene with nothing set reads Rolling recap, Manual only, Summary + chat and its model, in RoleCall's words", async () => {
    const m = await mount(rig(fresh()));
    expect(m.host.querySelector(".hero .eb")?.textContent).toBe("Long-term recall");
    expect(m.host.querySelector(".hero h2")?.textContent).toBe("Chat Summary");
    expect(m.host.querySelector(".hero p")?.textContent).toBe("Automatic summary generation is not currently running. You can still write or backfill the summary manually.");
    expect(tiles(m.host)).toEqual(["MethodRolling recap", "RunsManual only", "AI ContextSummary + chat", "Defaultclaude-sonnet-4"]);
    expect(m.host.textContent).toContain("Automatic summaries are off. Turn them on to summarize every 60 messages; manual edits and Backfill history still work.");
    m.done();
  });
  test("the loading and failed states are said", async () => {
    const r = rig(fresh());
    (r.ctx.api as unknown as { getSceneSummary(): Promise<never> }).getSceneSummary = async () => { throw new Error("library locked"); };
    const m = await mount(r);
    expect(m.host.querySelector('[role="alert"]')?.textContent).toBe("library locked");
    m.done();
  });
});

describe("Summary Controls", () => {
  test("the automation switch gives a switched-on rolling summary its cadence of 60, and the tiles and hero follow", async () => {
    const r = rig(fresh());
    const m = await mount(r);
    await click(byText(m.host, "button[role=switch]", "Automatic summaries are off"));
    expect(r.log.settings).toEqual([{ auto: true, interval: 60 }]);
    expect(tiles(m.host)[1]).toBe("RunsEvery 60 messages");
    expect(m.host.querySelector(".hero p")?.textContent).toBe("Auto-generated summary of your story with Vera. Runs at your exact configured interval and powers chat-card previews + AI context.");
    expect(byText(m.host, "button[role=switch]", "Automatic summaries are on")?.getAttribute("aria-checked")).toBe("true");
    expect(m.host.textContent).toContain("The summary updates after every 60 persisted messages.");
    m.done();
  });
  test("Include in AI context off says Off, and Hide messages already covered is disabled behind it", async () => {
    const r = rig(fresh());
    const m = await mount(r);
    await click(byText(m.host, "button[role=switch]", "Include saved summary in AI context"));
    expect(r.log.settings).toEqual([{ include: false }]);
    expect(tiles(m.host)[2]).toBe("AI ContextOff");
    expect((byText(m.host, "button[role=switch]", "Hide messages already covered") as HTMLButtonElement).disabled).toBe(true);
    m.done();
  });
  test("Summarize every writes on leaving the box: a number turns automation on, zero turns it off, and the same number writes nothing", async () => {
    const r = rig(fresh({ settings: { auto: true, interval: 30 } }));
    const m = await mount(r);
    await typeInto(field(m.host, "Summarize every"), "30");
    expect(r.log.settings).toEqual([]);
    await typeInto(field(m.host, "Summarize every"), "45");
    await typeInto(field(m.host, "Summarize every"), "0");
    expect(r.log.settings).toEqual([{ interval: 45 }, { interval: 0, auto: false }]);
    m.done();
  });
  test("Hide messages already covered picks Keep recent 60 and shows it; changing it writes the number", async () => {
    const r = rig(fresh());
    const m = await mount(r);
    await click(byText(m.host, "button[role=switch]", "Hide messages already covered"));
    expect(r.log.settings).toEqual([{ hideOld: true, keepRecent: 60 }]);
    expect(tiles(m.host)[2]).toBe("AI Context60 kept");
    expect(field<HTMLInputElement>(m.host, "Keep recent messages visible to AI").value).toBe("60");
    await typeInto(field(m.host, "Keep recent messages visible to AI"), "25");
    expect(r.log.settings.at(-1)).toEqual({ keepRecent: 25 });
    m.done();
  });
  test("a scene whose summary has its own model says so and offers the way back", async () => {
    const r = rig(fresh({ settings: { model: { id: "c2", model: "tiny-1" } } }));
    const m = await mount(r);
    expect(tiles(m.host)[3]).toBe("Customtiny-1");
    expect(m.host.textContent).toContain("This chat overrides its normal model for summaries.");
    await click(byText(m.host, ".mm-note button", "Use chat model"));
    expect(r.log.settings).toEqual([{ model: null }]);
    expect(m.host.textContent).not.toContain("This chat overrides");
    m.done();
  });
  test("Temperature is kept inside 0 to 1, and emptying the box goes back to the default", async () => {
    const r = rig(fresh());
    const m = await mount(r);
    await typeInto(field(m.host, "Temperature"), "5");
    await typeInto(field(m.host, "Temperature"), "");
    expect(r.log.settings).toEqual([{ temperature: 1 }, { temperature: null }]);
    m.done();
  });
  test("a failed run is shown as RoleCall shows it", async () => {
    const m = await mount(rig(fresh({ error: "provider said no" })));
    expect(m.host.querySelector(".mm-err")?.textContent).toBe("Last summary run failed: provider said no");
    m.done();
  });
});

describe("Advanced settings", () => {
  test("open on request, remembered as the viewer's own, and the method select changes what is asked: Every exchange has no interval and warns of its calls", async () => {
    const r = rig(fresh({ settings: { auto: true, interval: 20 } }));
    const m = await mount(r);
    const advanced = m.host.querySelector<HTMLDetailsElement>("details.mm-dis")!;
    expect(advanced.open).toBe(false);
    await click(advanced.querySelector("summary"));
    expect(r.prefs.get("context.memoryFolds")).toMatchObject({ advanced: true });
    await choose(field(m.host, "Summary method"), "pair");
    expect(r.log.settings).toEqual([{ method: "pair" }]);
    expect(field(m.host, "Summarize every")).toBeNull();
    expect(m.host.textContent).toContain("Per-pair mode appends one sentence to the summary after each assistant reply. It makes one summary-model API call per completed exchange.");
    expect(tiles(m.host)[0]).toBe("MethodEvery exchange");
    m.done();
  });
  test("choosing Growing timeline writes a rolling mode", async () => {
    const r = rig(fresh({ settings: { auto: true, method: "pair" } }));
    const m = await mount(r);
    await click(m.host.querySelector("details.mm-dis > summary"));
    await choose(field(m.host, "Summary method"), "additive");
    expect(r.log.settings).toEqual([{ interval: 60, method: "rolling", mode: "additive" }]);
    expect(tiles(m.host)[0]).toBe("MethodTimeline");
    m.done();
  });
  test("reasoning, truncation and the output budget write their own keys", async () => {
    const r = rig(fresh());
    const m = await mount(r);
    await click(m.host.querySelector("details.mm-dis > summary"));
    await click(byText(m.host, "button[role=switch]", "Enable reasoning"));
    await click(byText(m.host, "button[role=switch]", "Truncate messages"));
    await typeInto(field(m.host, "Max output tokens"), "300");
    expect(r.log.settings).toEqual([{ reasoning: true }, { truncate: true }, { maxTokens: 300 }]);
    expect(m.host.textContent).toContain("Limits each source message to 200 characters before summary generation.");
    m.done();
  });
  test("the prompt template shows the built-in prompt until you write your own, saves on leaving, and Reset prompt goes back", async () => {
    const r = rig(fresh());
    const m = await mount(r);
    await click(m.host.querySelector("details.mm-dis > summary"));
    await click(byText(m.host, "details.mm-dis details > summary", "Prompt template"));
    const box = field<HTMLTextAreaElement>(m.host, "Prompt template");
    expect(box.placeholder).toContain("Summarize this chat between the user and {{characterName}}");
    expect(m.host.textContent).toContain("No custom prompt: the built-in prompt for Rolling recap is used.");
    expect(m.host.textContent).toContain("Variables: {{characterName}}{{conversationHistory}}. Missing history is appended automatically.");
    await typeInto(box, "Recap {{conversationHistory}} briefly.");
    expect(r.log.settings).toEqual([{ prompt: "Recap {{conversationHistory}} briefly." }]);
    await click(byText(m.host, ".mm-vars button", "Reset prompt"));
    expect(r.log.settings.at(-1)).toEqual({ prompt: null });
    m.done();
  });
});

describe("Current Summary", () => {
  test("empty: RoleCall's words, and Write summary opens a box whose Save needs some text", async () => {
    const r = rig(fresh());
    const m = await mount(r);
    expect(m.host.textContent).toContain("No summary yet");
    expect(m.host.textContent).toContain("Write the context you want the AI to carry forward.");
    await click(byText(m.host, "button", "Write summary"));
    const save = byText(m.host, ".mm-acts button", "Save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await typeInto(field(m.host, "Summary text"), "Vera keeps the light.", false);
    expect((byText(m.host, ".mm-acts button", "Save") as HTMLButtonElement).disabled).toBe(false);
    await click(byText(m.host, ".mm-acts button", "Save"));
    expect(r.log.saved).toEqual(["Vera keeps the light."]);
    expect(m.host.querySelector(".mm-text p")?.textContent).toBe("Vera keeps the light.");
    expect(m.host.textContent).toContain("21 chars");
    m.done();
  });
  test("with automation on the empty state says the next exchange can write it", async () => {
    const m = await mount(rig(fresh({ settings: { auto: true, interval: 20 } })));
    expect(m.host.textContent).toContain("Write the starting context yourself, or let the next eligible exchange create it.");
    m.done();
  });
  test("a saved summary is read, edited with the pencil, and Cancel leaves it alone; a refused save says why and keeps the box", async () => {
    const r = rig(fresh({ text: "Old words.", through: 12, at: 3 }));
    const m = await mount(r);
    expect(m.host.querySelector(".mm-text p")?.textContent).toBe("Old words.");
    await click(m.host.querySelector('[aria-label="Edit summary"]'));
    expect(field<HTMLTextAreaElement>(m.host, "Summary text").value).toBe("Old words.");
    await click(byText(m.host, ".mm-acts button", "Cancel"));
    expect(m.host.querySelector(".mm-text p")?.textContent).toBe("Old words.");
    await click(m.host.querySelector('[aria-label="Edit summary"]'));
    await typeInto(field(m.host, "Summary text"), "boom", false);
    await click(byText(m.host, ".mm-acts button", "Save"));
    expect(m.host.querySelector('.mm-edit [role="alert"]')?.textContent).toBe("The summary could not be saved.");
    expect(field(m.host, "Summary text")).not.toBeNull();
    m.done();
  });
  test("Backfill history names this run's method and fills the box; a failure says why and keeps the old text", async () => {
    const r = rig(fresh({ text: "Old words.", through: 2, at: 3, settings: { method: "pair" } }));
    const m = await mount(r);
    expect(m.host.textContent).toContain("This run: Per-exchange. Full history is loaded and split adaptively for the selected model. You can switch methods afterward.");
    await click(byText(m.host, ".mm-back button", "Backfill history"));
    expect(r.log.backfills).toBe(1);
    expect(m.host.querySelector(".mm-text p")?.textContent).toBe("The whole story.");
    m.done();
    const bad = rig(fresh({ text: "Old words.", through: 2, at: 3 }), { backfill: async () => { throw new Error("One message exceeded the configured Max output tokens. Increase that setting and try again."); } });
    const n = await mount(bad);
    await click(byText(n.host, ".mm-back button", "Backfill history"));
    expect(n.host.querySelector(".mm-err")?.textContent).toBe("Last summary run failed: One message exceeded the configured Max output tokens. Increase that setting and try again.");
    expect(n.host.querySelector(".mm-text p")?.textContent).toBe("Old words.");
    n.done();
  });
  test("while a run is going the box says so and Backfill is off", async () => {
    const m = await mount(rig(fresh({ running: true })));
    expect(m.host.querySelector(".mm-wait")?.textContent).toBe("Generating summary...");
    expect((byText(m.host, ".mm-back button", "Backfill history") as HTMLButtonElement).disabled).toBe(true);
    m.done();
  });
});
