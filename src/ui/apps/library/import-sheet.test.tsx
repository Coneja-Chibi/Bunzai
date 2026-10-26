/** The import review list is windowed: 500 readable files mount a few cards. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expectWindowed, flushTasks, installDom, type InstalledDom } from "../../_shared/test-dom";
import { ImportOverlay } from "./import-sheet";
import type { ReadFile } from "./import-triage";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { observers: true, pretendToBeVisual: true, globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

const reads = Array.from({ length: 500 }, (_, i): ReadFile => ({
  filename: `card-${String(i)}.json`,
  result: { ok: true, receipt: { name: `Card ${String(i)}`, kindLine: "Character", extras: [] } } as unknown as ReadFile["result"],
}));

describe("ImportOverlay", () => {
  test("500 readable files mount fewer than 60 cards", async () => {
    const host = installed.dom.window.document.createElement("div");
    installed.dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<ImportOverlay state={{ phase: "done", reads, archiveReports: [] }} onCommit={() => undefined} onCancel={() => undefined} />); });
    await act(async () => { await flushTasks(6); });
    expectWindowed(installed.dom.window.document.body, ".improw", 500, 60);
    await act(async () => { root.unmount(); });
  });
});
