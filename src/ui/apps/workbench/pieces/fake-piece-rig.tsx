/**
 * A test stand-in for the Workbench around one small piece editor (tracker, tool, dice, formula): a fake app context whose saves are recorded, and
 * helpers that press, type and read through React the way a person would. Imported only by tests.
 */
import { act, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { PiecePatch } from "../../../../stage/contracts/content-store";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";
import { tick } from "../../../../stage/provider/test-fetch-harness";
import type { KindEditorProps } from "../editors";

export const installPieceDom = (): InstalledDom => installDom("<!doctype html><html><body></body></html>", {
  url: "http://127.0.0.1:8321/",
  extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "Event", "KeyboardEvent"],
  globals: { IS_REACT_ACT_ENVIRONMENT: true },
});

export interface SavedCall { kind: string; id: string; expected: string; patch: PiecePatch }

/** What a mounted tree offers a test: find, press, type, and take it down. */
export interface Mounted {
  host: HTMLElement;
  /** The first element matching the selector. */
  q<T extends Element = HTMLElement>(selector: string): T;
  /** The button whose text, label or title matches. */
  button(text: RegExp): HTMLButtonElement;
  /** Every such button, in page order. */
  buttons(text: RegExp): HTMLButtonElement[];
  /** The control with this accessible name. */
  field<T extends HTMLElement = HTMLInputElement>(label: string): T;
  type(el: HTMLElement, value: string): Promise<void>;
  click(el: Element): Promise<void>;
  unmount(): Promise<void>;
}

export interface Rig extends Mounted {
  saves: SavedCall[];
  status: string[];
  opened: StudioEntitySummary[];
}

export { tick };

const buttonsOf = (host: HTMLElement, text: RegExp): HTMLButtonElement[] =>
  [...host.querySelectorAll("button")].filter((b) => text.test(b.textContent ?? "") || text.test(b.getAttribute("aria-label") ?? "") || text.test(b.title));

/** Mounts any tree in its own container. */
export async function mountNode(node: ReactNode): Promise<Mounted> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let root!: Root;
  await act(async () => {
    root = createRoot(host);
    root.render(node);
    await tick();
  });
  return {
    host,
    q: <T extends Element = HTMLElement>(selector: string): T => host.querySelector<T>(selector)!,
    button: (text) => buttonsOf(host, text)[0]!,
    buttons: (text) => buttonsOf(host, text),
    field: <T extends HTMLElement = HTMLInputElement>(label: string) => host.querySelector<T>(`[aria-label="${label}"]`)!,
    type: async (el, value) => {
      const proto = el instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : el instanceof window.HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
        el.dispatchEvent(new window.Event(el instanceof window.HTMLSelectElement ? "change" : "input", { bubbles: true }));
        await tick();
      });
    },
    click: async (el) => { await act(async () => { (el as HTMLElement).click(); await tick(); }); },
    unmount: async () => { await act(async () => root.unmount()); host.remove(); },
  };
}

/** Mounts `Editor` on a piece of `kind` holding `body`; `api` adds or replaces calls on the fake app context. */
export async function mountEditor(Editor: ComponentType<KindEditorProps & { rand?: () => number }>, kind: string, body: unknown, extra: { api?: Record<string, unknown>; rand?: () => number } = {}): Promise<Rig> {
  const saves: SavedCall[] = [];
  const status: string[] = [];
  const opened: StudioEntitySummary[] = [];
  const piece = { id: "p1", kind, name: "A piece" } as StudioEntitySummary;
  const ctx = {
    setStatus: (s: string) => status.push(s),
    prefs: { get: () => undefined, set: () => undefined },
    workbench: { setDirty: () => undefined, open: (s: StudioEntitySummary) => opened.push(s) },
    api: {
      patchEditedEntity: async (k: string, id: string, expected: string, patch: PiecePatch) => { saves.push({ kind: k, id, expected, patch }); return { revision: "r2", summary: piece }; },
      listEntities: async () => [],
      listScenes: async () => [],
      getLinkedScenes: async () => [],
      ...extra.api,
    },
  } as unknown as AppContext;
  const entity = { schemaVersion: "1", kind, id: "p1", body };
  const mounted = await mountNode(<Editor entity={entity} revision="r1" ctx={ctx} piece={piece} {...(extra.rand ? { rand: extra.rand } : {})} />);
  return { ...mounted, saves, status, opened };
}
