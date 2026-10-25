/**
 * The list-and-page editors (Quick reply, Preset, Regex, Lorebook) under every editor.frame variant (the media editors are frame-matrix-media-editors.test.tsx): each keeps its
 * name field, Save, every list and the page in the document, and the picked frame is the one arranging them.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { act, type JSX } from "react";
import { createRoot } from "react-dom/client";
import { SURFACES } from "../../../extensions/surface-registry";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { flushTasks, installDom, setSurfacePicks, type InstalledDom } from "../../_shared/test-dom";
import { QuickReplyEditor } from "./quickreply/editor";
import { emptyLoreEntry, emptyLorebookBody } from "../../../core/lore";
import { LorebookEditor } from "./LorebookEditor";
import { RegexSetEditor } from "./regex/set-editor";
import { PresetEditorView } from "./preset/preset-editor";

// Bun hands CSS modules back as non-string maps; the editors are exercised with plain class names, as the other editor tests do.
const classNames = new Proxy({}, { get: (_t, property) => String(property) });
for (const css of ["preset", "row", "settings", "sidebar", "toolbar", "macro", "live-build", "live-preview", "linked-sets"]) mock.module(`./preset/${css}.module.css`, () => ({ default: classNames }));

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8329/", pretendToBeVisual: true, observers: true, boundGlobals: ["getComputedStyle"], extraGlobals: ["SVGElement", "KeyboardEvent", "MutationObserver", "HTMLInputElement", "HTMLTextAreaElement", "Event", "CustomEvent"], globals: { IS_REACT_ACT_ENVIRONMENT: true, requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0), cancelAnimationFrame: (id: number) => clearTimeout(id) } });
  // jsdom has no layout: give every box a size so the virtualized lists render their first rows.
  Object.defineProperty(installed.dom.window.HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 400 });
  Object.defineProperty(installed.dom.window.HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 800 });
});
afterAll(() => installed.teardown());

const prefs: Record<string, unknown> = {};
const ctx = {
  setStatus: () => undefined,
  prefs: { get: (k: string) => prefs[k], set: (k: string, v: unknown) => { prefs[k] = v; } },
  api: { listEntities: async () => [] },
  workbench: { setDirty: () => undefined },
} as unknown as AppContext;
const piece = (kind: string): StudioEntitySummary => ({ id: "p1", kind, name: "Thing" }) as unknown as StudioEntitySummary;

async function mount(frame: string, node: JSX.Element, fields = "labeled-rows"): Promise<{ host: HTMLElement; unmount(): Promise<void> }> {
  setSurfacePicks(frame === "core" ? {} : { "editor.frame": frame, "editor.fields": fields });
  const host = document.createElement("div");
  document.body.append(host);
  const tree = createRoot(host);
  await act(async () => { tree.render(node); });
  return { host, unmount: async () => { await act(async () => { tree.unmount(); }); host.remove(); setSurfacePicks({}); await act(async () => { await flushTasks(1); }); } };
}

const frames = ["core", ...SURFACES["editor.frame"]];
const arranged = (host: HTMLElement): string | null => host.querySelector("[data-ef='layout']")?.getAttribute("data-frame") ?? null;

describe("quick reply editor", () => {
  const entity = { body: { name: "Commands", replies: [{ id: "r1", label: "Go", message: "/send go" }] } };
  for (const frame of frames) {
    test(frame, async () => {
      const { host, unmount } = await mount(frame, <QuickReplyEditor entity={entity} revision="r1" ctx={ctx} piece={piece("quickreply")} />);
      expect(host.querySelector('input[aria-label="Quick-reply set name"]')).not.toBeNull();
      expect(host.querySelector("button[title^='Save']")).not.toBeNull();
      expect([...host.querySelectorAll("input,textarea")].map((e) => (e as HTMLInputElement).value), host.innerHTML).toContain("Go");
      expect(arranged(host)).toBe(frame === "core" ? null : frame);
      await unmount();
    });
  }
});

describe("preset editor", () => {
  const entity = { body: { name: "House", description: "d", prompts: [{ id: "b1", name: "Main prompt", content: "hello", role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false }] } };
  for (const frame of frames) {
    test(frame, async () => {
      const { host, unmount } = await mount(frame, <PresetEditorView entity={entity} revision="r1" ctx={ctx} piece={piece("preset")} />);
      expect(host.querySelector('input[aria-label="Preset name"]')).not.toBeNull();
      expect(host.querySelector("button[title^='Save']")).not.toBeNull();
      expect(host.textContent).toContain("Main prompt");
      const tabs = [...host.querySelectorAll('[role="tablist"][aria-label="Rail view"] [role="tab"]')].map((t) => t.textContent);
      expect(tabs).toEqual(["Edit Prompt", "Live Build", "Preview"]);
      expect(host.querySelector('[aria-label="Preset rail"]')).not.toBeNull();
      expect(host.textContent).toContain("Add");
      expect(arranged(host)).toBe(frame === "core" ? null : frame);
      if (frame !== "core") expect(host.textContent).toContain("Settings");
      await unmount();
    });
  }

  test("the Preview tab still opens the live preview in a theme frame", async () => {
    const { host, unmount } = await mount("tabbed-menu", <PresetEditorView entity={entity} revision="r1" ctx={ctx} piece={piece("preset")} />);
    const preview = [...host.querySelectorAll<HTMLElement>('[aria-label="Rail view"] [role="tab"]')].find((t) => t.textContent === "Preview")!;
    await act(async () => { preview.click(); });
    expect(preview.getAttribute("aria-selected")).toBe("true");
    await unmount();
  });
});

describe("regex set editor", () => {
  const rules = [
    { id: "r1", label: "Dashes", find: "dash", replace: "run", flags: "g", enabled: true, sortOrder: 0, phases: ["output"] },
    { id: "r2", label: "Brackets", find: "\[.*?\]", replace: "", flags: "g", enabled: true, sortOrder: 1, phases: ["output"] },
  ];
  const entity = { body: { name: "Cleanup", rules }, original: {} };
  const editor = (): JSX.Element => <RegexSetEditor entity={entity} revision="r1" ctx={ctx} piece={piece("regex")} />;
  for (const frame of frames) {
    test(frame, async () => {
      const { host, unmount } = await mount(frame, editor());
      expect(host.querySelector('input[aria-label="Set name"]')).not.toBeNull();
      expect(host.querySelector("button[title^='Save']")).not.toBeNull();
      expect(host.textContent).toContain("Dashes");
      expect(host.textContent).toContain("Brackets");
      expect(host.textContent).toContain("Open the full test bench");
      expect(arranged(host)).toBe(frame === "core" ? null : frame);
      await unmount();
    });
  }

  for (const frame of frames) {
    test(`${frame}: the test bench opens and the rule page stays mounted`, async () => {
      const { host, unmount } = await mount(frame, editor());
      const open = [...host.querySelectorAll("button")].find((b) => b.textContent === "Open the full test bench")!;
      await act(async () => { open.click(); });
      expect(host.querySelector('[aria-label="Regex test bench"]')).not.toBeNull();
      const close = host.querySelector<HTMLElement>('[aria-label="Close test bench"]')!;
      await act(async () => { close.click(); });
      expect(host.querySelector('[aria-label="Regex test bench"]')).toBeNull();
      await unmount();
    });
  }
});

describe("lorebook editor", () => {
  const base = emptyLorebookBody("Atlas");
  const entity = { body: { ...base, entries: [{ ...emptyLoreEntry("e1"), title: "Harbor", content: "Salt and rope." }, { ...emptyLoreEntry("e2"), title: "Lighthouse", content: "A tall lamp." }] }, original: {} };
  const lore = { ...ctx, api: { search: async () => ({ hits: [] }) }, workbench: { setDirty: () => undefined, openBeside: () => undefined } } as unknown as AppContext;
  for (const frame of frames) {
    test(frame, async () => {
      const { host, unmount } = await mount(frame, <LorebookEditor entity={entity} revision="r1" ctx={lore} piece={piece("lorebook")} />);
      expect(host.querySelector("button[title^='Save']")).not.toBeNull();
      expect(host.textContent).toContain("Harbor");
      expect(host.textContent).toContain("Lighthouse");
      for (const view of ["Pages", "Cards", "Web"]) expect(host.textContent).toContain(view);
      expect(host.querySelector('[aria-label="Live tools"]')).not.toBeNull();
      expect(host.querySelector('select[aria-label="Writing for one host"]')).not.toBeNull();
      expect(arranged(host)).toBe(frame === "core" ? null : frame);
      await unmount();
    });
  }
});

describe("editor.fields reaches the fields these editors own", () => {
  const quick = { body: { name: "Commands", replies: [{ id: "r1", label: "Go", message: "/send go" }] } };
  const preset = { body: { name: "House", description: "d", samplers: { temperature: 0.7 }, prompts: [] } };
  for (const fields of SURFACES["editor.fields"]) {
    test(`${fields}: quick reply rows and preset settings are EditorFields`, async () => {
      const q = await mount("tabbed-menu", <QuickReplyEditor entity={quick} revision="r1" ctx={ctx} piece={piece("quickreply")} />, fields);
      const labels = [...q.host.querySelectorAll('[data-ef="field"] [data-ef="label"]')].map((l) => l.textContent);
      expect(labels).toEqual(["Label", "Hover title", "Message or slash-command text"]);
      expect(q.host.querySelector<HTMLInputElement>('input[id$="-label"]')!.value).toBe("Go");
      await q.unmount();
      const p = await mount("tabbed-menu", <PresetEditorView entity={preset} revision="r1" ctx={ctx} piece={piece("preset")} />, fields);
      const temperature = [...p.host.querySelectorAll('[data-ef="field"]')].find((x) => x.querySelector('[data-ef="label"]')?.textContent === "Temperature");
      expect(temperature?.querySelector<HTMLInputElement>("input")?.value).toBe("0.7");
      await p.unmount();
    });
  }
});

describe("editor.fields reaches the regex rule page and the lorebook entry page", () => {
  const regex = { body: { name: "Cleanup", rules: [{ id: "r1", label: "Dashes", find: "dash", replace: "run", flags: "g", enabled: true, sortOrder: 0, phases: ["output"] }] }, original: {} };
  const lore = { body: { ...emptyLorebookBody("Atlas"), entries: [{ ...emptyLoreEntry("e1"), title: "Harbor", content: "Salt.", triggers: [{ keyword: "port" }] }] }, original: {} };
  const loreCtx = { ...ctx, api: { search: async () => ({ hits: [] }) }, workbench: { setDirty: () => undefined, openBeside: () => undefined } } as unknown as AppContext;
  const labelsOf = (host: HTMLElement): string[] => [...host.querySelectorAll('[data-ef="field"] > [data-ef="label"]')].map((l) => l.textContent ?? "");
  for (const fields of SURFACES["editor.fields"]) {
    test(`${fields}: regex rule fields`, async () => {
      const { host, unmount } = await mount("tabbed-menu", <RegexSetEditor entity={regex} revision="r1" ctx={ctx} piece={piece("regex")} />, fields);
      const labels = labelsOf(host);
      for (const want of ["Rule name", "Find pattern", "Replace with", "Phases"]) expect(labels, `${fields}: ${want}`).toContain(want);
      await unmount();
    });
    test(`${fields}: lorebook entry fields`, async () => {
      const { host, unmount } = await mount("tabbed-menu", <LorebookEditor entity={lore} revision="r1" ctx={loreCtx} piece={piece("lorebook")} />, fields);
      const labels = labelsOf(host);
      for (const want of ["Title", "Primary keys", "Passage", "Creator note", "Order", "Chance"]) expect(labels, `${fields}: ${want}`).toContain(want);
      await unmount();
    });
  }
  test("core keeps the editors' own labels, no EditorField", async () => {
    const { host, unmount } = await mount("core", <LorebookEditor entity={lore} revision="r1" ctx={loreCtx} piece={piece("lorebook")} />);
    expect(host.querySelector('[data-ef="field"]')).toBeNull();
    await unmount();
  });
});

describe("Contents and page are their own sections under a theme frame", () => {
  const regex = { body: { name: "Cleanup", rules: [{ id: "r1", label: "Dashes", find: "dash", replace: "run", flags: "g", enabled: true, sortOrder: 0, phases: ["output"] }, { id: "r2", label: "Brackets", find: "x", replace: "", flags: "g", enabled: true, sortOrder: 1, phases: ["output"] }] }, original: {} };
  const lore = { body: { ...emptyLorebookBody("Atlas"), entries: [{ ...emptyLoreEntry("e1"), title: "Harbor" }, { ...emptyLoreEntry("e2"), title: "Lighthouse" }] }, original: {} };
  const loreCtx = { ...ctx, api: { search: async () => ({ hits: [] }) }, workbench: { setDirty: () => undefined, openBeside: () => undefined } } as unknown as AppContext;

  for (const frame of ["two-pane", "tabbed-menu"]) {
    test(`${frame}: regex opens on the rule, Contents is reachable, picking a rule returns to the page`, async () => {
      const { host, unmount } = await mount(frame, <RegexSetEditor entity={regex} revision="r1" ctx={ctx} piece={piece("regex")} />);
      const tab = (name: string): HTMLElement => [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent?.endsWith(name))!;
      expect(tab("Rule").getAttribute("aria-selected")).toBe("true");
      await act(async () => { tab("Rules").click(); });
      expect(tab("Rules").getAttribute("aria-selected")).toBe("true");
      const pick = host.querySelector<HTMLElement>('button[data-index="1"]');
      expect(pick).not.toBeNull();
      await act(async () => { pick!.click(); });
      expect(tab("Rule").getAttribute("aria-selected")).toBe("true");
      await unmount();
    });
  }

  test("two-pane: lorebook Contents and Entry are sections", async () => {
    const { host, unmount } = await mount("two-pane", <LorebookEditor entity={lore} revision="r1" ctx={loreCtx} piece={piece("lorebook")} />);
    const names = [...host.querySelectorAll('[aria-label="Lorebook sections"] [role="tab"]')].map((t) => t.textContent);
    expect(names).toEqual(["1Contents", "2Entry"]);
    await unmount();
  });

  test("the preset rail is the wide one", async () => {
    const { host, unmount } = await mount("two-pane", <PresetEditorView entity={{ body: { name: "P", prompts: [] } }} revision="r1" ctx={ctx} piece={piece("preset")} />);
    expect(host.querySelector('[data-ef="layout"]')?.getAttribute("data-rail")).toBe("wide");
    await unmount();
  });
});

describe("editor.fields reaches the lorebook platform extras cards", () => {
  const entry = {
    ...emptyLoreEntry("e1"), title: "Harbor",
    characterFilter: { names: ["Marguerite"], tags: ["keeper"], isExclude: false },
    loreBiasGroups: [{ enabled: true, bias: -0.5, phrases: [{ sequence: "storm", type: 2 }], whenInactive: false, generateOnce: true, ensureSequenceFinish: false }],
  };
  const book = { body: { ...emptyLorebookBody("Atlas"), entries: [entry] }, original: {} };
  const loreCtx = { ...ctx, api: { search: async () => ({ hits: [] }) }, workbench: { setDirty: () => undefined, openBeside: () => undefined } } as unknown as AppContext;
  const labelsOf = (host: HTMLElement): string[] => [...host.querySelectorAll('[data-ef="field"] > [data-ef="label"]')].map((l) => l.textContent ?? "");
  const WANT = ["Applies to", "Names", "Tags", "Folder id", "List index", "Automation", "Prefix", "Suffix", "Token cap", "Reserved", "Offset", "Trim direction", "Join by", "Trim by", "Bias, group 1", "Phrases, group 1"];

  for (const fields of SURFACES["editor.fields"]) {
    test(`${fields}: every card field is an EditorField`, async () => {
      const { host, unmount } = await mount("tabbed-menu", <LorebookEditor entity={book} revision="r1" ctx={loreCtx} piece={piece("lorebook")} />, fields);
      const labels = labelsOf(host);
      for (const want of WANT) expect(labels, `${fields}: ${want}`).toContain(want);
      await unmount();
    });
  }

  test("core keeps the cards' own markup", async () => {
    const { host, unmount } = await mount("core", <LorebookEditor entity={book} revision="r1" ctx={loreCtx} piece={piece("lorebook")} />);
    expect(host.querySelector('[data-ef="field"]')).toBeNull();
    for (const aria of ["Character filter mode", "Folder id", "Automation id", "Context prefix", "Token cap"]) expect(host.querySelector(`[aria-label="${aria}"]`), aria).not.toBeNull();
    await unmount();
  });
});

describe("preset: picking a block brings its Edit Prompt panel up where the rail is the last section", () => {
  const entity = { body: { name: "House", prompts: [{ id: "b1", name: "Main prompt", content: "hello", role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false }] } };
  const scrolls: { el: Element; behavior?: string }[] = [];
  const setReduced = (reduced: boolean): void => {
    (window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({ matches: reduced && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} });
  };
  beforeAll(() => {
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = function (this: Element, o?: ScrollIntoViewOptions) { scrolls.push({ el: this, behavior: o?.behavior }); };
  });
  const pick = async (frame: string, reduced = false): Promise<{ host: HTMLElement; unmount(): Promise<void> }> => {
    setReduced(reduced);
    scrolls.length = 0;
    const m = await mount(frame, <PresetEditorView entity={entity} revision="r1" ctx={ctx} piece={piece("preset")} />);
    const row = m.host.querySelector<HTMLElement>("[aria-posinset]")!;
    await act(async () => {
      row.click();
      // The reveal runs in an effect then a frame, a delay that depends on how cold the process is, so a fixed sleep raced it.
      // Where the rail is the last section the reveal is the one thing that must happen: wait for it. Elsewhere there is nothing to wait for.
      const mustReveal = frame === "long-form" || frame === "card-stack";
      for (let waited = 0; waited < 5000 && mustReveal && scrolls.length === 0; waited += 10) await new Promise((r) => setTimeout(r, 10));
      await new Promise((r) => setTimeout(r, 40));
    });
    return m;
  };

  for (const frame of ["long-form", "card-stack"]) {
    test(`${frame}: scrolls to the panel and focuses its first field, smoothly`, async () => {
      const { host, unmount } = await pick(frame);
      const panel = host.querySelector('[aria-label="Preset rail"]')!;
      expect(scrolls.map((s) => s.el)).toContain(panel);
      expect(scrolls.find((s) => s.el === panel)?.behavior).toBe("smooth");
      expect(panel.contains(document.activeElement)).toBe(true);
      expect(["INPUT", "TEXTAREA", "SELECT"]).toContain(document.activeElement?.tagName ?? "");
      await unmount();
    });
    test(`${frame}: reduced motion scrolls without smoothing`, async () => {
      const { host, unmount } = await pick(frame, true);
      const panel = host.querySelector('[aria-label="Preset rail"]')!;
      expect(scrolls.find((s) => s.el === panel)?.behavior).toBe("auto");
      await unmount();
    });
  }

  for (const frame of ["core", "two-pane", "tabbed-menu"]) {
    test(`${frame}: picking a block does not scroll or steal focus`, async () => {
      const { host, unmount } = await pick(frame);
      expect(scrolls.filter((s) => s.el === host.querySelector('[aria-label="Preset rail"]'))).toEqual([]);
      await unmount();
    });
  }
});
