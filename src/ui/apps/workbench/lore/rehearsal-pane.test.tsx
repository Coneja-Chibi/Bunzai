/** The Rehearsal pane windows its "Didn't fire" list: a 500-entry book that fires nothing mounts a few rows. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import { emptyLoreEntry, emptyLorebookBody } from "../../../../core/lore/empty-book";
import { expectWindowed, flushTasks, installDom, type InstalledDom } from "../../../_shared/test-dom";
import { RehearsalPane } from "./rehearsal-pane";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { observers: true, pretendToBeVisual: true, extraGlobals: ["Event", "HTMLInputElement"], globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

const entry = (id: string): LorebookEntry => ({ ...emptyLoreEntry(id), title: `Entry ${id}`, content: `content ${id}`, id });
const body: LorebookBody = { ...emptyLorebookBody("rehearse"), entries: Array.from({ length: 500 }, (_, i) => entry(`e${String(i)}`)) };

describe("RehearsalPane", () => {
  test("500 entries that did not fire mount fewer than 60 rows", async () => {
    const win = installed.dom.window;
    const host = win.document.createElement("div");
    win.document.body.appendChild(host);
    const root = createRoot(host);
    const noop = (): void => undefined;
    await act(async () => { root.render(<RehearsalPane body={body} onClose={noop} onJumpEntry={noop} />); });
    const input = host.querySelector<HTMLInputElement>('input[aria-label="Rehearsal line"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(input, "hello there");
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
    });
    await act(async () => { host.querySelector("form")!.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true })); });
    const miss = [...host.querySelectorAll("details")].find((d) => d.textContent?.includes("Didn't fire"))!;
    await act(async () => { miss.open = true; miss.dispatchEvent(new win.Event("toggle")); });
    await act(async () => { await flushTasks(6); });
    expectWindowed(miss, "[data-index]", 500, 60);
    await act(async () => { root.unmount(); });
  });
});
