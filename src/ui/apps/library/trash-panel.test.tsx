/**
 * F1 GREEN evidence for the Trash panel: a heavy delete pass can leave
 * hundreds of graves; 2,000 render far fewer than 2,000 `.trow` nodes. The shared virtualizer
 * mechanics are proven once against `grid.tsx`/`virtual-list.test.tsx`; this file proves
 * `trash-panel.tsx`'s own wiring, including its new bounded scroll box (`.ltrash-rows`).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import type { GraveSummary } from "../../../stage/contracts/content-store";
import { installDom, type InstalledDom, expectWindowed, flushTasks } from "../../_shared/test-dom";
import { TrashPanel } from "./trash-panel";

let dom: JSDOM;
let installed: InstalledDom;


beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8464/",
    pretendToBeVisual: true,
    extraGlobals: ["DOMParser"],
    boundGlobals: ["getComputedStyle"],
    globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
  dom = installed.dom;
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", { configurable: true, value: 1024 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", {
    configurable: true, get(this: HTMLElement) { return this.className.includes("ltrash-rows") ? 608 : 54; },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", { configurable: true, value: 1024 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", { configurable: true, value: 608 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollWidth", { configurable: true, value: 10_000_000 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollHeight", { configurable: true, value: 10_000_000 });
});
afterAll(() => installed.teardown());

const N = 2000;
const graves: GraveSummary[] = Array.from({ length: N }, (_, i) => ({
  graveId: `grave-${i}`, id: `piece-${i}`, kind: "character", name: `Deleted ${i}`, deletedAt: Date.now() - i,
}));

function makeCtx(scenes: unknown[] = [], pieces: GraveSummary[] = graves): AppContext {
  return {
    api: {
      listTrash: async () => pieces,
      listSceneTrash: async () => scenes,
    },
    setStatus: () => undefined,
  } as unknown as AppContext;
}

async function mountTrash(ctx: AppContext = makeCtx()): Promise<{ host: HTMLElement; unmount(): Promise<void> }> {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<TrashPanel ctx={ctx} onBack={() => undefined} onRestored={() => undefined} />); });
  // the grave list loads asynchronously (trashRows); let it settle.
  await act(async () => { await flushTasks(6); });
  return { host, unmount: async () => { await act(async () => { root.unmount(); }); host.remove(); } };
}

describe("Trash (trash-panel.tsx) virtualized", () => {
  test(`${String(N)} graves render far fewer than ${String(N)} .trow nodes`, async () => {
    const { host, unmount } = await mountTrash();
    expectWindowed(host, ".trow", N);
    await unmount();
  });

  test("C-1: a wheel/scrollbar scroll never drops the focused row - activeElement stays put", async () => {
    const { host, unmount } = await mountTrash();
    const scroller = host.querySelector<HTMLElement>(".ltrash-rows")!;
    const focused = host.querySelector<HTMLElement>('[data-pick="grave-0"] button')!;
    await act(async () => { focused.focus(); });
    expect(dom.window.document.activeElement).toBe(focused);

    await act(async () => {
      scroller.scrollTop = 200_000;
      scroller.dispatchEvent(new dom.window.Event("scroll"));
      await new Promise((r) => setTimeout(r, 50));
    });
    await act(async () => { await flushTasks(6); });

    expect(dom.window.document.activeElement).toBe(focused);
    expect(host.contains(focused)).toBe(true);
    await unmount();
  });

  test("C-2: aria-setsize/aria-posinset survive virtualization, role=\"list\" on the row list", async () => {
    const { host, unmount } = await mountTrash();
    const rows = [...host.querySelectorAll<HTMLElement>(".trow")];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.getAttribute("aria-setsize")).toBe(String(N));
      const flat = Number(row.dataset["pick"]!.replace("grave-", ""));
      expect(Number(row.getAttribute("aria-posinset"))).toBe(flat + 1);
    }
    expect(host.querySelector(".ltrash-rows")?.getAttribute("role")).toBe("list");
    await unmount();
  });
});

describe("removed versions (ChatStore rule 32)", () => {
  test("a removed version says it is kept until restored, with no countdown, while a deleted take keeps its days left", async () => {
    const now = Date.now();
    const scenes = [
      { kind: "version", id: "m1:s1", name: "Once, a tide.", of: "Night watch", messageCount: 1, at: 3, deletedAt: now - 1000 },
      { kind: "take", id: "b1", name: "Take 2", of: "Night watch", messageCount: 4, deletedAt: now - 2000 },
    ];
    const { host, unmount } = await mountTrash(makeCtx(scenes, []));
    const rows = [...host.querySelectorAll<HTMLElement>(".trow")];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("version of message 3 in Night watch");
    expect(rows[0]!.textContent).toContain("kept until restored");
    expect(rows[0]!.textContent).not.toMatch(/left/);
    expect(rows[1]!.textContent).toMatch(/left/);
    await unmount();
  });
});
