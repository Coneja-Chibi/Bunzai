/**
 * The Control Booth's Chat Summary row and the Readout's Tokens figure (rc-parity 08, follow-up 2). Both compose the Context wing's own modules: the row writes through the same
 * `setSceneSummarySettings` the Memory tab uses (same couplings), and the Tokens figure is the last reply's request as the trace stored it.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import type { ChatSummaryState, SceneTrace } from "../../app-contract-scenes";
import type { Chat, SummarySettingsPatch } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";
import { installDom, type InstalledDom } from "../../_shared/test-dom";


let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8325/",
    pretendToBeVisual: true,
    extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "sessionStorage"],
    boundGlobals: ["getComputedStyle"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) },
  });
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});
afterAll(() => installed.teardown());

const cast = { character: { id: "c1", version: 1, name: "Char" } } as Chat["cast"];
const chat: Chat = { id: "chat1", title: "Scene", cast, activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 1 };
const scene = { chat, messages: [], messageCount: 0, snapshot: {} } as unknown as OpenScene;
const summary = (settings: ChatSummaryState["settings"] = {}, over: Partial<ChatSummaryState> = {}): ChatSummaryState => ({ settings, text: null, through: 0, at: null, total: 0, error: null, running: false, ...over });
const trace = (over: Partial<SceneTrace> = {}): SceneTrace => ({ reply: { messageId: "m", swipeId: "s", number: 2, model: "m", take: "Director's Cut" }, blocks: [{ kind: "prompt", label: "Main", role: "system", tokens: 500, category: "preset" }], window: { context: 8000, reply: 1000, stated: true }, trimmed: 0, lore: null, rawAvailable: false, replies: [], ...over });

let state: ChatSummaryState;
let readFails: boolean;
let traceFor: SceneTrace | null;
let patches: SummarySettingsPatch[];
let opened: string[];

beforeEach(() => {
  installed.reinstall();
  state = summary();
  readFails = false;
  traceFor = null;
  patches = [];
  opened = [];
});

function makeCtx(): AppContext {
  const api = {
    getEditableEntity: async () => ({ entity: null, revision: "r" }), getSceneLore: async () => ({ books: [], lastTurn: null }), sceneConnections: async () => [], connectionModels: async () => ({ models: [], saved: "" }), listLoadouts: async () => [], latestLoadoutReceipt: async () => null,
    getSceneSummary: async () => { if (readFails) throw new Error("library locked"); return state; },
    setSceneSummarySettings: async (_id: string, patch: SummarySettingsPatch) => {
      patches.push(patch);
      state = { ...state, settings: { ...state.settings, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== null)) } };
      return state;
    },
    getSceneTrace: async () => traceFor,
  };
  return { api, setStatus: () => undefined, prefs: { get: () => undefined, set: () => undefined }, workbench: { open: () => undefined }, openApp: () => undefined } as unknown as AppContext;
}

let root: Root | null = null;
let host: HTMLElement;
/** Every mounted wing is unmounted before the next test: its summary poll and late answers must not outlive the page they were written for. */
async function drop(): Promise<void> {
  const current = root;
  root = null;
  if (current) (await import("react-dom")).flushSync(() => current.unmount());
}
afterEach(drop);
type FlushSync = typeof import("react-dom")["flushSync"];
const settle = async (flushSync: FlushSync, ms = 20): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); };

async function mount(): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { BoothWing } = await import("./scene-booth-wing");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const mine = (root = createRoot(host));
  flushSync(() => mine.render(<BoothWing ctx={makeCtx()} scene={scene} busy={false} art={<span />} onChat={() => undefined} onSettings={() => undefined} onOpen={(w) => opened.push(w)} />));
  await settle(flushSync);
  return flushSync;
}
const tiles = (part: string): string[] => [...host.querySelectorAll(`[data-part="${part}"] > div`)].map((t) => `${t.querySelector("small")?.textContent}:${t.querySelector("b")?.textContent}`);
const toggle = (label: string): HTMLButtonElement => host.querySelector<HTMLButtonElement>(`[data-part="scene.booth.summary"] button[aria-label$="${label}"]`)!;

describe("Booth: Chat Summary", () => {
  test("shows when summaries run and what reaches the AI, and the two switches reflect the saved settings", async () => {
    await mount();
    expect(host.querySelector('[data-part="scene.booth.summary"] h3')?.textContent).toBe("Chat Summary");
    expect(tiles("scene.booth.summary.tiles")).toEqual(["Runs:Manual only", "AI Context:Summary + chat"]);
    expect(toggle("automatic summaries").getAttribute("aria-checked")).toBe("false");
    expect(toggle("the saved summary in AI context").getAttribute("aria-checked")).toBe("true");
  });

  test("Automatic summaries writes the Memory tab's patch (a cadence of 60 with it) and the tiles follow", async () => {
    const flushSync = await mount();
    flushSync(() => toggle("automatic summaries").click());
    await settle(flushSync);
    expect(patches).toEqual([{ auto: true, interval: 60 }]);
    expect(tiles("scene.booth.summary.tiles")[0]).toBe("Runs:Every 60 messages");
    expect(toggle("automatic summaries").getAttribute("aria-checked")).toBe("true");
  });

  test("Include in AI context writes its one key, and Off reads as Off in the tile", async () => {
    const flushSync = await mount();
    flushSync(() => toggle("the saved summary in AI context").click());
    await settle(flushSync);
    expect(patches).toEqual([{ include: false }]);
    expect(tiles("scene.booth.summary.tiles")[1]).toBe("AI Context:Off");
  });

  test("the last automatic run's failure is said, Open Memory goes to the Context wing, and an unreadable summary says why", async () => {
    state = summary({}, { error: "model refused" });
    const flushSync = await mount();
    expect(host.querySelector('[data-part="scene.booth.summary"] [role="alert"]')?.textContent).toContain("model refused");
    flushSync(() => [...host.querySelectorAll("button")].find((b) => b.textContent === "Open Memory")!.click());
    expect(opened).toEqual(["context"]);
    await drop();
    readFails = true;
    await mount();
    expect(host.querySelector('[data-part="scene.booth.summary"] [role="alert"]')?.textContent).toContain("library locked");
    expect(host.querySelector('[data-part="scene.booth.summary"] button[aria-checked]')).toBeNull();
  });
});

describe("Booth: Scene Readout Tokens", () => {
  test("the last request's size from the trace: the provider's count, else the assembler's with a tilde, in RoleCall's k cut", async () => {
    traceFor = trace({ turn: { exact: true, sent: 1234, at: 1 } });
    await mount();
    expect(tiles("scene.booth.readout")).toContain("Tokens:1.2k");
    await drop();
    traceFor = trace();
    await mount();
    expect(tiles("scene.booth.readout")).toContain("Tokens:~500");
  });

  test("before any reply there is no figure, only a dash", async () => {
    await mount();
    expect(tiles("scene.booth.readout")).toContain("Tokens:-");
  });
});

