/** Mood Music's "Show Music tab" sub-row (RoleCall StagecraftExtensions.tsx:1535-1552): a per-user pref that hides the Stage wing's Music tab, never the playback. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import type { AppContext } from "../../../../app-contract";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import { MUSIC_TAB_PREF } from "../../stage-music-core";
import { MusicTabRow } from "./music-tab-row";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8335/", extraGlobals: ["SVGElement", "Event"] }); dom = installed.dom; });
afterAll(() => installed.teardown());

describe("MusicTabRow", () => {
  test("reads on by default, says what it does, and its switch saves the pref", async () => {
    const store = new Map<string, unknown>();
    const ctx = { prefs: { get: (k: string) => store.get(k), set: (k: string, v: unknown) => { store.set(k, v); } } } as unknown as AppContext;
    const { flushSync } = await import("react-dom");
    const { createRoot } = await import("react-dom/client");
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    flushSync(() => root.render(<MusicTabRow ctx={ctx} chat={{ id: "c" } as Chat} />));
    expect(host.textContent).toContain("Show Music tab");
    expect(host.textContent).toContain("Hide the right-side tab while keeping MoodMusic playback active.");
    const sw = host.querySelector<HTMLButtonElement>("button[role=switch]")!;
    expect(sw.getAttribute("aria-label")).toBe("Hide Mood Music tab");
    expect(sw.getAttribute("aria-checked")).toBe("true");
    flushSync(() => sw.click());
    expect(store.get(MUSIC_TAB_PREF)).toBe(false);
    expect(host.querySelector("button[role=switch]")!.getAttribute("aria-label")).toBe("Show Mood Music tab");
    flushSync(() => root.unmount());
  });
});
