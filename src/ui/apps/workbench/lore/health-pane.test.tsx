/** The Health pane windows a long findings list: 500 entries with a broken field mount a few rows. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import { emptyLoreEntry, emptyLorebookBody } from "../../../../core/lore/empty-book";
import { inspectBook } from "../../../../core/lore";
import { expectWindowed, flushTasks, installDom, type InstalledDom } from "../../../_shared/test-dom";
import { HealthPane } from "./health-pane";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { observers: true, pretendToBeVisual: true, globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

const entry = (id: string): LorebookEntry => ({ ...emptyLoreEntry(id), title: `Entry ${id}`, content: `content ${id}`, id });
const body: LorebookBody = { ...emptyLorebookBody("health"), entries: Array.from({ length: 500 }, (_, i) => entry(`e${String(i)}`)) };

describe("HealthPane", () => {
  test("500 findings mount fewer than 60 rows", async () => {
    expect(inspectBook(body).length).toBeGreaterThan(200);
    const host = installed.dom.window.document.createElement("div");
    installed.dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    const noop = (): void => undefined;
    await act(async () => { root.render(<HealthPane body={body} onTransform={noop} onJumpEntry={noop} onClose={noop} />); });
    await act(async () => { await flushTasks(6); });
    expectWindowed(host, "[data-index]", 500, 60);
    await act(async () => { root.unmount(); });
  });
});
