/** The attach list is windowed: 500 lorebooks mount a few rows. */
import { afterAll, beforeAll, describe, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { StudioEntitySummary } from "../../app-contract";
import { expectWindowed, flushTasks, installDom, type InstalledDom } from "../../_shared/test-dom";
import { AttachLoreDialog } from "./index";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { observers: true, pretendToBeVisual: true, extraGlobals: ["Event", "HTMLDialogElement"], globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

describe("AttachLoreDialog", () => {
  test("500 lorebooks mount fewer than 60 rows", async () => {
    const books = Array.from({ length: 500 }, (_, i) => ({ id: `b${String(i)}`, kind: "lorebook", name: `Book ${String(i)}`, hasPortrait: false }) as StudioEntitySummary);
    const host = installed.dom.window.document.createElement("div");
    installed.dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<AttachLoreDialog books={books} alreadyLinked={[]} onConfirm={() => undefined} onDismiss={() => undefined} />); });
    await act(async () => { await flushTasks(6); });
    expectWindowed(installed.dom.window.document.body, "[data-index]", 500, 60);
    await act(async () => { root.unmount(); });
  });
});
