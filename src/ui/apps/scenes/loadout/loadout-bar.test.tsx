/**
 * The Booth's loadout bar as it mounts (loadout-bar.tsx): save a scene as a loadout, change the setup from the switcher, the
 * receipt banner and its 15 minute Undo. The real engine runs against one in-memory scene (fake-scenes-store.ts), so each
 * apply is read back through the wings that own the settings (AI, Prompting, World), and the clock is the test's own.
 */
import { fakeScrollerLayout } from "../fake-scroller";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../../app-contract";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../../studio/scenes";
import { UNDO_MS } from "../../../../core/loadout-panels";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";
import { fakeScenesStore, type FakeScenesStore } from "./fake-scenes-store";


let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8325/",
    pretendToBeVisual: true,
    extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "sessionStorage", "localStorage"],
    boundGlobals: ["getComputedStyle"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) }
  });
  dom = installed.dom;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  fakeScrollerLayout(dom.window);
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});
afterAll(() => installed.teardown());
afterEach(() => {
  try { flushSync(() => root.unmount()); } catch { /* already unmounted by the test */ }
  dom.window.document.body.replaceChildren();
});

// -- fixtures ------------------------------------------------------------------------------------

const NOTE = { text: "Tense.", position: "in_chat", depth: 4, frequency: 2 } as const;
let store: FakeScenesStore;
/** The api the bar is given: the store's, with a member a test may replace to make a call fail. */
let api: Record<string, unknown>;
let settled: { scene: OpenScene; units: readonly string[] }[];
let root: Root;
let host: HTMLElement;
type FlushSync = typeof import("react-dom")["flushSync"];
let flushSync: FlushSync;

beforeEach(() => {
  installed.reinstall();
  settled = [];
  store = fakeScenesStore({ persona: null, connection: { id: "old", model: "old-model" }, prompting: { note: NOTE } });
  api = { listEntities: async () => [], ...store.scenesApi };
});

const ctxOf = (): AppContext => ({ api, setStatus: () => undefined, prefs: { get: () => undefined, set: () => undefined }, workbench: { open: () => undefined }, openApp: () => undefined }) as unknown as AppContext;
const settle = async (ms = 20): Promise<void> => {
  await new Promise((r) => setTimeout(r, ms));
  flushSync(() => undefined);
};

async function mountBar(over: { busy?: boolean; tickMs?: number; scene?: OpenScene } = {}): Promise<void> {
  flushSync = (await import("react-dom")).flushSync;
  const { createRoot } = await import("react-dom/client");
  const { LoadoutBar } = await import("./loadout-bar");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  const scene = over.scene ?? store.sceneOf();
  flushSync(() => root.render(<LoadoutBar ctx={ctxOf()} scene={scene} busy={over.busy ?? false} onSettings={(next, units) => settled.push({ scene: next, units })} now={() => store.clock.now} tickMs={over.tickMs ?? 3_600_000} />));
  await settle();
}
const unmount = (): void => { flushSync(() => root.unmount()); host.remove(); };
const call = (name: string, ...args: unknown[]): Promise<unknown> => (api[name] as (...a: unknown[]) => Promise<unknown>)(...args);

const body = (): HTMLElement => dom.window.document.body;
const text = (): string => body().textContent ?? "";
const button = (label: string, within: ParentNode = body()): HTMLButtonElement | undefined => [...within.querySelectorAll("button")].find((b) => b.textContent?.trim() === label || b.getAttribute("aria-label") === label);
const click = async (el: Element | null | undefined): Promise<void> => {
  expect(el).toBeTruthy();
  flushSync(() => (el as HTMLElement).click());
  await settle();
};
const propsOf = (el: Element): Record<string, (e: unknown) => void> => (el as unknown as Record<string, Record<string, (e: unknown) => void>>)[Object.keys(el).find((k) => k.startsWith("__reactProps$"))!]!;
const type = async (el: Element, value: string): Promise<void> => { flushSync(() => propsOf(el)["onChange"]!({ target: { value } })); await settle(); };
const dialog = (name: string): HTMLElement | null => body().querySelector(`[role="dialog"][aria-label="${name}"]`);
const rowsOf = (): string[] => [...body().querySelectorAll("[data-loadout]")].map((r) => r.getAttribute("data-loadout")!);

/** Saves the scene's setup under a name through the real dialog. */
async function saveAs(name: string): Promise<void> {
  await click(button("Save this scene as a loadout"));
  await type(dialog("Save this scene as a loadout")!.querySelector("input[aria-label=Name]")!, name);
  await click(button("Save selected settings"));
}

// -- save ------------------------------------------------------------------------------------------

describe("saving a scene as a loadout", () => {
  test("opens with RoleCall's defaults, ticks what the scene holds, and the loadout it saves is the live scene", async () => {
    await mountBar();
    await click(button("Save this scene as a loadout"));
    const d = dialog("Save this scene as a loadout")!;
    expect(d.textContent).toContain("This saves reusable settings only. Messages, takes, and variables stay out.");
    expect(d.textContent).toContain("What to include · 2 of 11");
    const name = d.querySelector("input[aria-label=Name]") as HTMLInputElement;
    expect(name.value).toBe("My Loadout");
    expect(name.maxLength).toBe(40);
    expect(name.placeholder).toBe("My Loadout");
    expect(d.textContent).toContain("Not set on this scene");
    // the scene changes under the dialog while it is open: the save reads the scene as it is then
    store.scene.prompting = { note: { ...NOTE, text: "Quiet." } };
    await click(button("Save selected settings"));
    expect(store.loadouts).toHaveLength(1);
    expect(store.loadouts[0]!.name).toBe("My Loadout");
    expect(store.loadouts[0]!.values).toEqual({ mainModel: { id: "old", model: "old-model" }, authorNote: { ...NOTE, text: "Quiet." } });
    expect(dialog("Save this scene as a loadout")).toBeNull();
    expect(text()).toContain('Saved "My Loadout"');
    unmount();
  });

  test("the saved loadout is listed in the switcher with its setting count", async () => {
    await mountBar();
    await saveAs("Slow burn");
    await click(button("Change setup"));
    expect(dialog("Scene loadouts")!.textContent).toContain("Slow burn");
    expect(dialog("Scene loadouts")!.textContent).toContain("2 settings");
    unmount();
  });

  test("All current, Writing only and None move the ticks; Writing only is the six live writing panels", async () => {
    store.scene.preset = { id: "p", toggles: {}, samplers: { temperature: 0.4 } };
    await mountBar({ scene: store.sceneOf() });
    await click(button("Save this scene as a loadout"));
    const d = dialog("Save this scene as a loadout")!;
    await click(button("All current", d));
    expect(d.textContent).toContain("What to include · 11 of 11");
    await click(button("Writing only", d));
    expect(d.textContent).toContain("What to include · 6 of 11");
    await click(button("None", d));
    expect(d.textContent).toContain("What to include · 0 of 11");
    expect(d.textContent).toContain("More settings will join this list as their wings arrive.");
    unmount();
  });

  test("Update existing starts from the chosen loadout's panels, and replaces it", async () => {
    store.scene.prompting = { note: NOTE, guides: ["g1"] };
    await mountBar();
    await saveAs("Base"); // mainModel, guides, authorNote
    await click(button("Save this scene as a loadout"));
    const d = dialog("Save this scene as a loadout")!;
    await click(button("None", d));
    await click(button("Update existing", d));
    flushSync(() => propsOf(d.querySelector("select[aria-label='Loadout to update']")!)["onChange"]!({ target: { value: "l1" } }));
    await settle();
    expect(d.textContent).toContain("What to include · 3 of 11");
    await click(button("Update selected loadout", d));
    expect(store.loadouts).toHaveLength(1);
    expect(store.loadouts[0]!.id).toBe("l1");
    expect(store.loadouts[0]!.panels).toEqual(["mainModel", "authorNote", "guides"]);
    unmount();
  });

  test("a refused save (the 101st) says so inside the dialog and keeps it open", async () => {
    for (let i = 0; i < 100; i++) await call("saveLoadout", { name: `n${i}`, values: {} });
    await mountBar();
    await click(button("Save this scene as a loadout"));
    await click(button("Save selected settings"));
    const d = dialog("Save this scene as a loadout")!;
    expect(d.querySelector("[role=alert]")?.textContent).toBe("You have 100 loadouts. Delete one first.");
    expect(store.loadouts).toHaveLength(100);
    unmount();
  });

  test("Update existing asks for a loadout first, and Enter in the name saves", async () => {
    await mountBar();
    await click(button("Save this scene as a loadout"));
    const d = dialog("Save this scene as a loadout")!;
    expect(button("Update existing", d)!.disabled).toBe(true);
    flushSync(() => propsOf(d.querySelector("input[aria-label=Name]")!)["onKeyDown"]!({ key: "Enter", preventDefault: () => undefined }));
    await settle();
    expect(store.loadouts).toHaveLength(1);
    unmount();
  });
});

// -- apply, banner, undo -------------------------------------------------------------------------------

/** A saved loadout that differs from the scene: another model and another note. */
async function seedLoadout(name = "Slow burn"): Promise<void> {
  await call("saveLoadout", { name, values: { mainModel: { id: "new", model: "new-model" }, authorNote: { ...NOTE, text: "Slow." } } });
}
const apply = async (name = "Slow burn"): Promise<void> => {
  await click(button("Change setup"));
  await click(button(`Apply ${name}`));
};

describe("changing the setup", () => {
  test("Apply writes through the engine, the page is handed the new scene, and the AI, Prompting and World wings read it", async () => {
    store.scene.lore = { added: [], off: [] };
    await seedLoadout();
    await call("saveLoadout", { name: "Lore", values: { lorebooks: { added: ["b2"], off: ["b1"] } } });
    await mountBar();
    await apply("Slow burn");
    expect(store.scene.connection).toEqual({ id: "new", model: "new-model" });
    expect(store.scene.prompting?.note?.text).toBe("Slow.");
    expect(dialog("Scene loadouts")).toBeNull();
    expect(settled.at(-1)!.scene.chat.connection).toEqual({ id: "new", model: "new-model" });
    expect(settled.at(-1)!.units).toEqual(["connection", "note"]);
    const banner = body().querySelector("[data-part='scene.booth.loadouts.banner']")!;
    expect(banner.textContent).toContain("Slow burn applied");
    expect(banner.textContent).toContain("2 settings · receipt LD-");
    expect(banner.textContent).toContain("undo 15m");
    expect(banner.textContent).toContain("Active loadout is provenance, not a lock. Messages and takes were not touched.");
    unmount();

    // the same store, read by the wings that own these settings
    const { createRoot } = await import("react-dom/client");
    const chat: Chat = store.chatOf();
    const read = async (el: JSX.Element): Promise<void> => {
      host = dom.window.document.createElement("div");
      body().appendChild(host);
      root = createRoot(host);
      flushSync(() => root.render(el));
      await settle();
    };
    const { AiWing } = await import("../scene-ai-wing");
    const ctx = ctxOf();
    Object.assign(ctx.api, { sceneConnections: async () => [{ id: "new", label: "Harbor", kind: "openai", model: "new-model" }], connectionModels: async () => ({ models: [{ id: "new-model", context: 64000 }], saved: "new-model" }) });
    await read(<AiWing ctx={ctx} chat={chat} onPicked={() => undefined} />);
    expect(host.querySelector(".mrow.cur")?.textContent).toContain("new-model");
    unmount();
    const { PromptingWing } = await import("../scene-prompting");
    await read(<PromptingWing ctx={ctx} chat={chat} presetBody={null} onChanged={() => undefined} onBody={() => undefined} />);
    await click([...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Scene Note")));
    expect((host.querySelector("textarea[aria-label='Note content']") as HTMLTextAreaElement).value).toBe("Slow.");
    unmount();
  });

  test("a part-way failure names the rows that applied and the ones that did not, and Undo puts back what did apply", async () => {
    await seedLoadout();
    store.failing.add("note");
    await mountBar();
    await apply();
    const banner = body().querySelector("[data-part='scene.booth.loadouts.banner']")!;
    expect(banner.textContent).toContain("Slow burn partly applied · 1 of 2 settings");
    expect(banner.textContent).toContain("Applied: Model and connection.");
    expect(banner.textContent).toContain("Not applied: Scene note. Undo puts back what did apply.");
    expect(banner.textContent).toContain("note refused");
    expect(store.scene.connection?.model).toBe("new-model");
    store.failing.clear();
    await click(button("Undo apply"));
    expect(store.scene.connection).toEqual({ id: "old", model: "old-model" });
    expect(store.scene.prompting?.note?.text).toBe("Tense.");
    unmount();
  });

  test("Undo inside the 15 minutes restores the scene, hands it to the page, and the banner goes", async () => {
    await seedLoadout();
    await mountBar();
    await apply();
    store.clock.now += UNDO_MS - 1000;
    await click(button("Undo apply"));
    expect(store.scene.connection).toEqual({ id: "old", model: "old-model" });
    expect(store.scene.prompting?.note?.text).toBe("Tense.");
    expect(settled.at(-1)!.scene.chat.connection).toEqual({ id: "old", model: "old-model" });
    expect(text()).toContain("Loadout changes undone");
    expect(body().querySelector("[data-part='scene.booth.loadouts.banner']")).toBeNull();
    unmount();
  });

  test("after 15 minutes there is no Undo", async () => {
    await seedLoadout();
    await mountBar({ tickMs: 10 });
    await apply();
    expect(button("Undo apply")).toBeDefined();
    store.clock.now += UNDO_MS + 1;
    await settle(60);
    expect(button("Undo apply")).toBeUndefined();
    expect(body().querySelector("[data-part='scene.booth.loadouts.banner']")).toBeNull();
    expect(store.scene.connection?.model).toBe("new-model");
    unmount();
  });

  test("the receipt is in the library, so a banner mounted fresh (leaving the scene and coming back) still has its Undo", async () => {
    await seedLoadout();
    await mountBar();
    await apply();
    unmount();
    await mountBar();
    expect(body().querySelector("[data-part='scene.booth.loadouts.banner']")?.textContent).toContain("Slow burn applied");
    expect(button("Undo apply")).toBeDefined();
    unmount();
  });

  test("a loadout that was removed is gone from the switcher, and listed again once restored", async () => {
    await seedLoadout();
    await mountBar();
    await click(button("Change setup"));
    expect(rowsOf()).toEqual(["l1"]);
    await click(button("Close loadout switcher"));
    await call("deleteLoadout", "l1");
    await click(button("Change setup"));
    expect(rowsOf()).toEqual([]);
    expect(dialog("Scene loadouts")!.textContent).toContain("No saved loadouts yet. Save this scene's setup to start one.");
    await click(button("Close loadout switcher"));
    await call("restoreLoadout", "l1");
    await click(button("Change setup"));
    expect(rowsOf()).toEqual(["l1"]);
    unmount();
  });

  test("the active mark follows the receipt's loadout id, not its name", async () => {
    await seedLoadout("Twin");
    await seedLoadout("Twin");
    await mountBar();
    await click(button("Change setup"));
    await click(dialog("Scene loadouts")!.querySelector("[data-loadout=l2] button"));
    await click(button("Change setup"));
    const row = (id: string): string => dialog("Scene loadouts")!.querySelector(`[data-loadout=${id}]`)!.textContent!;
    expect(row("l2")).toContain("2 settings · active");
    expect(row("l1")).not.toContain("active");
    expect(dialog("Scene loadouts")!.textContent).toMatch(/Active · Twin · 2 settings · LD-/);
    unmount();
  });

  test("while a reply is being written Apply and Undo are off", async () => {
    await seedLoadout();
    await mountBar({ busy: true });
    await click(button("Change setup"));
    expect(button("Apply Slow burn")!.disabled).toBe(true);
    expect(store.calls).not.toContain("connection");
    unmount();
  });

  test("a read that fails says RoleCall's apply error and writes nothing", async () => {
    await seedLoadout();
    await mountBar();
    api["sceneSettings"] = async () => { throw new Error("offline"); };
    await apply();
    expect(dialog("Scene loadouts")!.querySelector("[role=alert]")?.textContent).toBe("Could not apply this loadout. Your changes may be incomplete. Try again or review your current setup.");
    expect(store.calls).toEqual(["loadout-save"]);
    unmount();
  });

  test("a loadout the scene already matches says so and leaves no receipt", async () => {
    await seedLoadout();
    store.scene.connection = { id: "new", model: "new-model" };
    store.scene.prompting = { note: { ...NOTE, text: "Slow." } };
    await mountBar();
    await apply();
    expect(dialog("Scene loadouts")!.textContent).toContain("Nothing to change. This scene already has this setup.");
    expect(store.receipts.size).toBe(0);
    unmount();
  });
});

describe("reviewing the changes first", () => {
  test("the three counts match the plan, the rows say how each applies, and Apply loadout applies it", async () => {
    store.scene.prompting = { note: { ...NOTE, text: "Slow." } };
    await seedLoadout(); // the note already matches; the model differs
    await call("saveLoadout", { name: "Mixed", values: { mainModel: { id: "new", model: "new-model" }, authorNote: { ...NOTE, text: "Slow." }, persona: "p9" } });
    await mountBar();
    await click(button("Change setup"));
    await click(dialog("Scene loadouts")!.querySelector("[data-loadout=l2] button:nth-of-type(2)"));
    const d = dialog("Review changes")!;
    expect(d.textContent).toContain("Apply Mixed?");
    const metric = (label: string): string => [...d.querySelectorAll("[data-metric]")].find((m) => m.querySelector("small")?.textContent === label)!.querySelector("b")!.textContent!;
    expect([metric("Will change"), metric("Stay as-is"), metric("Protected")]).toEqual(["1", "1", "1"]);
    expect(d.textContent).toContain("Model and connection");
    expect(d.textContent).toContain("Always protected: messages · takes · variables");
    await click(button("Apply loadout", d));
    expect(store.scene.connection?.model).toBe("new-model");
    expect(dialog("Review changes")).toBeNull();
    unmount();
  });

  test("Cancel closes the review without writing", async () => {
    await seedLoadout();
    await mountBar();
    await click(button("Change setup"));
    await click(button("Review changes", dialog("Scene loadouts")!));
    await click(button("Cancel"));
    expect(dialog("Review changes")).toBeNull();
    expect(store.calls).toEqual(["loadout-save"]);
    unmount();
  });
});

describe("no side channels", () => {
  test("a save, an apply and an Undo dispatch no window event and write no browser storage", async () => {
    const win = dom.window as unknown as Window & typeof globalThis;
    const seen: string[] = [];
    const wrap = <T extends object>(obj: T, key: keyof T, label: string): void => {
      const original = obj[key] as unknown as (...a: unknown[]) => unknown;
      (obj as Record<keyof T, unknown>)[key] = (...a: unknown[]) => { seen.push(label); return original.apply(obj, a); };
    };
    await seedLoadout();
    await mountBar();
    wrap(win, "dispatchEvent", "window.dispatchEvent");
    wrap(win.localStorage, "setItem", "localStorage.setItem");
    wrap(win.sessionStorage, "setItem", "sessionStorage.setItem");
    await saveAs("Second");
    await apply();
    await click(button("Undo apply"));
    expect(seen).toEqual([]);
    unmount();
  });
});
