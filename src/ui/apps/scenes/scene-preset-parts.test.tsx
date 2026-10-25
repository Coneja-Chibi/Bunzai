/**
 * B20 (dup-audit/ui.md item 9): PromptList is the one virtualized list of the 7 in the Studio that
 * skipped the shared focus-preservation helpers (`useFocusedRangeIndex`/`keepFocusedInRange`/
 * `bridgeTabAcrossVirtualBoundary` from `_shared/virtual-list.tsx`), which every sibling view
 * (`views/grid.tsx`, `views/list.tsx`, `shelves.tsx`, `trash-panel.tsx`, `views/persona-shelf.tsx`,
 * `block-list.tsx`) wires. C-1 proves the bug this skip causes: a mouse-wheel/scrollbar scroll (no
 * Tab) must not drop a focused row out of the DOM.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PresetBody, PresetPrompt } from "../../../entities/preset/schema";
import { installDom, type InstalledDom } from "../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;


beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8327/",
    pretendToBeVisual: true,
    boundGlobals: ["getComputedStyle"],
    globals: { IS_REACT_ACT_ENVIRONMENT: true }
  });
  dom = installed.dom;
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", {
    configurable: true, get(this: HTMLElement) { return this.className === "side-list" ? 280 : 260; },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", {
    configurable: true, get(this: HTMLElement) { return this.className === "side-list" ? 720 : 40; },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", { configurable: true, value: 720 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollHeight", { configurable: true, value: 10_000_000 });
});
afterAll(() => installed.teardown());

const prompt = (id: string): PresetPrompt => ({
  id, name: `Prompt ${id}`, content: `content-${id}`, role: "system", enabled: true, systemPrompt: true,
  marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false,
});

const N = 200;
const body: PresetBody = {
  name: "Big Preset",
  prompts: Array.from({ length: N }, (_, i) => prompt(String(i))),
  samplers: {},
};

let root: Root | null = null;
let host: HTMLElement;

async function mount(): Promise<void> {
  const { PromptList } = await import("./scene-preset-parts");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <PromptList
        body={body}
        prefs={{ get: () => undefined, set: () => undefined }}
        toggles={{}}
        selected={null}
        onSelect={() => undefined}
        onToggle={() => undefined}
        onToggleGroup={() => undefined}
      />,
    );
  });
}

function unmount(): void {
  act(() => root?.unmount());
  host.remove();
  root = null;
}

describe("PromptList virtualized (B20)", () => {
  test("fewer than N rows are in the DOM (virtualized)", async () => {
    await mount();
    const rows = host.querySelectorAll(".side-listrow");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(N);
    unmount();
  });

  test("C-1: a wheel/scrollbar scroll never drops the focused row - activeElement stays put", async () => {
    await mount();
    // Groups start folded (RoleCall's initialCategoriesCollapsed): open the one group the rows are in.
    act(() => host.querySelector<HTMLButtonElement>(".cat-t")!.click());
    const scroller = host.querySelector(".side-list") as HTMLElement;
    // Focus the toggle switch inside the last visible prompt row - something inside the row, same
    // as every sibling's own C-1 proof focuses a real interactive descendant, not the row itself.
    const toggles = [...host.querySelectorAll<HTMLButtonElement>("[role=switch]")];
    const target = toggles[toggles.length - 1]!;
    act(() => target.focus());
    expect(dom.window.document.activeElement).toBe(target);

    // Scroll far down - not a Tab press, a wheel/scrollbar move - which must not unmount the row
    // holding the focused element.
    act(() => {
      scroller.scrollTop = 5000;
      scroller.dispatchEvent(new dom.window.Event("scroll"));
    });

    expect(dom.window.document.activeElement).toBe(target);
    expect(target.isConnected).toBe(true);
    unmount();
  });
});
