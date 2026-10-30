/**
 * Persona, Sprite pack, HTML doc and Character editors under every editor.frame x editor.fields pairing: each keeps its
 * name, its fields and its actions in the document (a closed menu section is only hidden, never unmounted),
 * the section menu is keyboard-reachable, and the core frame still draws the editor's own layout.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { act } from "react";
import type { Root } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import { SURFACES } from "../../../extensions/surface-registry";
import { flushTasks, installDom, setSurfacePicks, type InstalledDom } from "../../_shared/test-dom";

const classNames = new Proxy({}, { get: (_t, property) => String(property) });
mock.module("./htmldoc.module.css", () => ({ default: classNames }));

let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8329/",
    extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "MutationObserver", "getComputedStyle"],
    globals: { IS_REACT_ACT_ENVIRONMENT: true, requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) }
  });
  const proto = installed.dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;
});
afterAll(() => installed.teardown());
beforeEach(() => { installed.reinstall(); setSurfacePicks({}); });

const prefs: Record<string, unknown> = {};
const ctx = {
  setStatus: () => undefined,
  prefs: { get: (k: string) => prefs[k], set: (k: string, v: unknown) => { prefs[k] = v; } },
  // any call the editors make that this test does not care about answers with an empty list
  api: new Proxy({ saveEditedEntity: async () => ({ revision: "r2" }), patchEditedEntity: async () => ({ revision: "r2" }) } as Record<string, unknown>, { get: (t, k) => t[k as string] ?? (async () => []) }),
  workbench: { setDirty: () => undefined, remove: () => undefined, dirty: () => ({}) },
  pieces: { artVersion: () => 0, list: () => [], snapshot: () => undefined, getGeneration: () => 0, subscribe: () => () => undefined },
} as unknown as AppContext;

async function mount(node: () => Promise<React.JSX.Element>, frame: string, fields: string): Promise<{ host: HTMLElement; unmount(): Promise<void> }> {
  setSurfacePicks(frame === "core" ? {} : { "editor.frame": frame, "editor.fields": fields });
  const { createRoot } = await import("react-dom/client");
  const host = document.createElement("div");
  document.body.append(host);
  const root: Root = createRoot(host);
  const element = await node();
  await act(async () => { root.render(element); });
  await act(async () => { await flushTasks(); });
  return { host, unmount: async () => { await act(async () => { root.unmount(); }); host.remove(); } };
}

const persona = async (): Promise<React.JSX.Element> => {
  const { PersonaEditor } = await import("./PersonaEditor");
  const piece = { id: "p1", kind: "persona", name: "Ada" } as unknown as StudioEntitySummary;
  const entity = { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "persona", id: "p1", body: { name: "Ada", content: "I am Ada." }, original: {} };
  return <PersonaEditor entity={entity} revision="r1" ctx={ctx} piece={piece} />;
};
const pack = async (): Promise<React.JSX.Element> => {
  const { PackEditor } = await import("./PackEditor");
  const piece = { id: "k1", kind: "pack", name: "Faces" } as unknown as StudioEntitySummary;
  const entity = { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "pack", id: "k1", body: { name: "Faces", brief: "a brief", pack: { items: [], enabled: true } }, original: {} };
  return <PackEditor entity={entity} revision="r1" ctx={ctx} piece={piece} />;
};
const htmldoc = async (): Promise<React.JSX.Element> => {
  const { HtmlDocEditor } = await import("./htmldoc-editor");
  const piece = { id: "d1", kind: "htmldoc", name: "Sketch" } as unknown as StudioEntitySummary;
  return <HtmlDocEditor entity={{ body: { name: "Sketch", html: "<b>hi</b>", summary: "a sketch" }, original: {} }} revision="r1" ctx={ctx} piece={piece} />;
};

const character = async (): Promise<React.JSX.Element> => {
  const { CharacterEditor } = await import("./Editor");
  const piece = { id: "c1", kind: "character", name: "Ada" } as unknown as StudioEntitySummary;
  const entity = { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id: "c1", body: { name: "Ada", description: "A tinkerer.", personality: "Curious.", firstMes: "Hello." }, original: {} };
  return <CharacterEditor entity={entity} revision="r1" ctx={ctx} piece={piece} />;
};

/** every labelled or placeholdered control and every button, as text: what a person can reach in the editor */
const controlsOf = (host: HTMLElement): Set<string> =>
  new Set([...host.querySelectorAll("input,textarea,select,button")].map((e) => `${e.tagName}:${e.getAttribute("aria-label") ?? e.getAttribute("placeholder") ?? e.textContent ?? ""}`));
const coreControls = new Map<string, Set<string>>();

const editors: { name: string; build: () => Promise<React.JSX.Element>; present: string[] }[] = [
  { name: "character", build: character, present: ['input[placeholder="A short, catchy description..."]', "button[title^='Save']", '[data-tour="layout"] button'] },
  { name: "persona", build: persona, present: ['input[aria-label="Persona name"]', 'input[aria-label="Tagline"]', 'textarea[aria-label="Personality"]', 'textarea[aria-label="Identity text"]', "button[title^='Save']", "button[aria-pressed]"] },
  { name: "pack", build: pack, present: ['input[aria-label="Pack name"]', "textarea", "button"] },
  { name: "htmldoc", build: htmldoc, present: ['input[aria-label="Drawing name"]', 'input[aria-label="Summary"]', 'textarea[aria-label="HTML source"]'] },
];

for (const editor of editors) {
  describe(`${editor.name} editor`, () => {
    for (const frame of ["core", ...SURFACES["editor.frame"]]) {
      test(`${frame}: every field and action is in the document`, async () => {
        const fieldsPick = SURFACES["editor.fields"][SURFACES["editor.frame"].indexOf(frame as never)] ?? "labeled-rows";
        const { host, unmount } = await mount(editor.build, frame, fieldsPick);
        for (const selector of editor.present) expect(host.querySelector(selector), `${frame}: ${selector}`).not.toBeNull();
        const here = controlsOf(host);
        if (frame === "core") coreControls.set(editor.name, here);
        else expect([...coreControls.get(editor.name)!].filter((c) => !here.has(c) && !c.startsWith("BUTTON:")), `${frame}: controls the core layout has and this one lost`).toEqual([]);
        if (frame === "two-pane" || frame === "tabbed-menu") {
          const tabs = [...host.querySelectorAll<HTMLElement>('[data-ef="nav"] [role="tab"]')];
          expect(tabs.length).toBeGreaterThan(1);
          await act(async () => { tabs[0]!.focus(); tabs[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); });
          expect(document.activeElement === tabs[1]).toBe(true);
        }
        if (frame === "long-form" || frame === "card-stack") expect(host.querySelectorAll('[data-ef="section"]').length).toBeGreaterThan(1);
        if (frame === "core" && editor.name === "persona") expect(host.querySelector('[data-frame="core"]')).not.toBeNull();
        await unmount();
      });
    }

    for (const fields of SURFACES["editor.fields"]) {
      test(`fields ${fields}: renders under card-stack with the same fields`, async () => {
        const { host, unmount } = await mount(editor.build, "card-stack", fields);
        for (const selector of editor.present) expect(host.querySelector(selector), `${fields}: ${selector}`).not.toBeNull();
        await unmount();
      });
    }
  });
}

describe("the character editor's Bento | Playbill pair", () => {
  test("View options keeps both layouts enabled in core and disabled with a note under a theme frame", async () => {
    const options = async (host: HTMLElement): Promise<HTMLElement> => {
      await act(async () => { host.querySelector<HTMLButtonElement>('[data-tour="layout"] button')!.click(); });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-label="View options"]');
      expect(dialog).not.toBeNull();
      return dialog!;
    };
    const pair = (dialog: HTMLElement): HTMLButtonElement[] => [...dialog.querySelectorAll<HTMLButtonElement>('[aria-label="Editor layout"] button')];
    const core = await mount(character, "core", "labeled-rows");
    const coreOptions = await options(core.host);
    expect(pair(coreOptions).map((b) => b.textContent)).toEqual(["Bento", "Playbill"]);
    expect(pair(coreOptions).every((b) => !b.disabled)).toBe(true);
    await act(async () => { pair(coreOptions)[1]!.click(); });
    expect(pair(coreOptions)[1]!.getAttribute("aria-pressed")).toBe("true");
    await core.unmount();
    const themed = await mount(character, "card-stack", "cards");
    const themedOptions = await options(themed.host);
    expect(pair(themedOptions).map((b) => b.textContent)).toEqual(["Bento", "Playbill"]);
    expect(pair(themedOptions).every((b) => b.disabled)).toBe(true);
    expect(themedOptions.textContent).toContain("This theme sets how the editor is arranged.");
    await themed.unmount();
  });
});
