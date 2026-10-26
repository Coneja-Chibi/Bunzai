/** What fired is windowed: 500 injected entries and 500 misses mount a few rows each. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { SceneTrace } from "../../../../app-contract-scenes";
import { expectWindowed, flushTasks, installDom, type InstalledDom } from "../../../../_shared/test-dom";
import { HareHits } from "./hare-hits";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { observers: true, pretendToBeVisual: true, globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

const hit = (i: number) => ({ bookId: "b1", entryId: `e${String(i)}`, bookName: "Book", title: `Entry ${String(i)}`, reason: "key" as const, matched: ["k"], tokens: 1, place: "World", loop: 0 });
const trace = {
  reply: { messageId: "m", swipeId: "s", number: 1, model: "m", take: "t" },
  lore: { injected: Array.from({ length: 500 }, (_, i) => hit(i)), cut: [], missed: Array.from({ length: 500 }, (_, i) => ({ bookId: "b1", entryId: `m${String(i)}`, bookName: "Book", title: `Miss ${String(i)}`, reason: "cooldown" as const, why: "cooling" })), chains: [], totalTokens: 500, share: 250, seed: 1 },
} as unknown as SceneTrace;

describe("HareHits", () => {
  test("500 fired entries and 500 misses mount fewer than 60 rows each", async () => {
    const host = installed.dom.window.document.createElement("div");
    installed.dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<HareHits trace={trace} group={false} sort="placement" showMisses />); });
    await act(async () => { await flushTasks(6); });
    expectWindowed(host, '[data-part="props.trackhare.hit"]', 500, 60);
    const open = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Didn't fire"))!;
    await act(async () => { open.click(); });
    await act(async () => { await flushTasks(6); });
    expectWindowed(host, ".mi", 500, 60);
    expect(host.querySelectorAll(".mi").length).toBeGreaterThan(0);
    await act(async () => { root.unmount(); });
  });
});
