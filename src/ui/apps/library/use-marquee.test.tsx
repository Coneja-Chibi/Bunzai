/**
 * A marquee drag must be able to START from the gap between two cards inside a virtualized row
 * wrapper, not only from the exact container element: a virtualized grid
 * puts a positioning div between the scroll container and its cards, so the pre-F1 rule (a strict
 * `target === currentTarget` check) silently disabled starting a drag from most of the grid. A
 * press still belongs to the CARD, never a sweep, when it lands inside one.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act, type PointerEvent as ReactPointerEvent } from "react";
import { createRoot } from "react-dom/client";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { useMarquee } from "./use-marquee";

let dom: JSDOM;
let installed: InstalledDom;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8465/",
    // jsdom provides PointerEvent directly; the MouseEvent fallback in the original bootstrap only
    // mattered for older jsdom versions that lacked it.
    extraGlobals: ["PointerEvent"],
    globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

/** A drag only reports a sweep once the pointer travels (select-core.ts's `isDrag`); this fires
 * pointerdown then a real window pointermove far enough to count, which is what the hook watches. */
function drag(onPointerDown: (ev: ReactPointerEvent<HTMLElement>) => void, target: Element, startX: number): boolean {
  let started = false;
  const fakeDown = { button: 0, target, currentTarget: target, clientX: startX, clientY: 0, shiftKey: false, ctrlKey: false, metaKey: false } as unknown as ReactPointerEvent<HTMLElement>;
  onPointerDown(fakeDown);
  const move = new dom.window.MouseEvent("pointermove", { clientX: startX + 20, clientY: 20 });
  dom.window.dispatchEvent(move);
  started = true; // presence of a drawn box is asserted by the caller via the hook's returned `box`
  return started;
}

describe("useMarquee: starting a sweep across a virtualized row wrapper", () => {
  test("a press on the gap inside a row wrapper (not the scroll container) still starts a sweep", async () => {
    const container = dom.window.document.createElement("div");
    const row = dom.window.document.createElement("div"); // a virtualized row wrapper: between container and cards
    const card = dom.window.document.createElement("button");
    card.dataset["pick"] = "character:x";
    const gap = dom.window.document.createElement("span"); // empty space in the row, beside the card
    row.append(card, gap);
    container.append(row);
    dom.window.document.body.append(container);

    let box: unknown = null;
    let onPointerDown: ((ev: ReactPointerEvent<HTMLElement>) => void) | null = null;
    function Probe(): null {
      const m = useMarquee(() => undefined);
      box = m.box;
      onPointerDown = m.onPointerDown;
      return null;
    }
    const host = dom.window.document.createElement("div");
    dom.window.document.body.append(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); });

    await act(async () => {
      drag(onPointerDown!, row, 10);
    });
    // A started drag draws a box once the pointer has moved past the drag threshold.
    expect(box).not.toBeNull();

    await act(async () => { root.unmount(); });
    host.remove();
  });

  test("a press on the card itself never starts a sweep - that press belongs to the card", async () => {
    const container = dom.window.document.createElement("div");
    const card = dom.window.document.createElement("button");
    card.dataset["pick"] = "character:x";
    container.append(card);
    dom.window.document.body.append(container);

    let box: unknown = null;
    let onPointerDown: ((ev: ReactPointerEvent<HTMLElement>) => void) | null = null;
    function Probe(): null {
      const m = useMarquee(() => undefined);
      box = m.box;
      onPointerDown = m.onPointerDown;
      return null;
    }
    const host = dom.window.document.createElement("div");
    dom.window.document.body.append(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); });

    await act(async () => {
      drag(onPointerDown!, card, 10);
    });
    expect(box).toBeNull();

    await act(async () => { root.unmount(); });
    host.remove();
  });
});
