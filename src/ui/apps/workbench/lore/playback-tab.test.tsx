/** The Playback tab windows a long chat: a 500-line export mounts a few turns. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { emptyLoreEntry, emptyLorebookBody } from "../../../../core/lore/empty-book";
import { expectWindowed, flushTasks, installDom, type InstalledDom } from "../../../_shared/test-dom";
import { PlaybackTab } from "./playback-tab";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { observers: true, pretendToBeVisual: true, extraGlobals: ["File", "Event"], globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

describe("PlaybackTab", () => {
  test("a 500-line export mounts fewer than 60 turns", async () => {
    const win = installed.dom.window;
    const host = win.document.createElement("div");
    win.document.body.appendChild(host);
    const root = createRoot(host);
    const body = { ...emptyLorebookBody("pb"), entries: [{ ...emptyLoreEntry("a"), title: "A" }] };
    await act(async () => { root.render(<PlaybackTab body={body} onJumpEntry={() => undefined} />); });
    const lines = Array.from({ length: 500 }, (_, i) => JSON.stringify({ name: i % 2 ? "Vera" : "You", is_user: i % 2 === 0, mes: `line ${String(i)}` }));
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [new win.File([lines.join("\n")], "chat.jsonl")] });
    await act(async () => { input.dispatchEvent(new win.Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 50)); });
    await act(async () => { await flushTasks(6); });
    expect(host.textContent).toContain("Replayed 500 lines");
    expectWindowed(host, "[data-index]", 500, 60);
    await act(async () => { root.unmount(); });
  });
});
