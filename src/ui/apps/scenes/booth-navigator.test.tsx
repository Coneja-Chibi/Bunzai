/** The Character Library windows its rows: 500 characters mount a few. */
import { afterAll, beforeAll, describe, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { expectWindowed, flushTasks, installDom, type InstalledDom } from "../../_shared/test-dom";
import { CharacterLibrary } from "./booth-navigator";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { observers: true, pretendToBeVisual: true, extraGlobals: ["Event", "HTMLDialogElement"], globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

describe("CharacterLibrary", () => {
  test("500 characters mount fewer than 60 rows", async () => {
    const list = Array.from({ length: 500 }, (_, i) => ({ id: `c${String(i)}`, kind: "character", name: `Character ${String(i)}`, hasPortrait: false }) as StudioEntitySummary);
    const ctx = { api: { listEntities: async () => list }, setStatus: () => undefined } as unknown as AppContext;
    const host = installed.dom.window.document.createElement("div");
    installed.dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<CharacterLibrary ctx={ctx} currentId="c0" onClose={() => undefined} />); });
    await act(async () => { await flushTasks(6); });
    expectWindowed(installed.dom.window.document.body, ".bth-libl [data-index]", 500, 60);
    await act(async () => { root.unmount(); });
  });
});
