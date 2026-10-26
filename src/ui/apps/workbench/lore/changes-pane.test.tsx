/** The Changes pane windows a long diff: 500 added entries mount a few rows. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import { emptyLoreEntry, emptyLorebookBody } from "../../../../core/lore/empty-book";
import { expectWindowed, flushTasks, installDom, type InstalledDom } from "../../../_shared/test-dom";
import { ChangesPane } from "./changes-pane";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { observers: true, pretendToBeVisual: true, globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

const entry = (id: string): LorebookEntry => ({ ...emptyLoreEntry(id), title: `Entry ${id}`, content: `content ${id}`, id });
const bookOf = (entries: LorebookEntry[]): LorebookBody => ({ ...emptyLorebookBody("diff"), entries });

describe("ChangesPane", () => {
  test("500 added entries mount fewer than 60 rows", async () => {
    const host = installed.dom.window.document.createElement("div");
    installed.dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    const noop = (): void => undefined;
    const body = bookOf(Array.from({ length: 500 }, (_, i) => entry(`e${String(i)}`)));
    await act(async () => { root.render(<ChangesPane baseline={bookOf([])} body={body} onRevertField={noop} onRestoreEntry={noop} onUndoSwap={noop} onJumpEntry={noop} onClose={noop} />); });
    await act(async () => { await flushTasks(6); });
    expectWindowed(host, "[data-index]", 500, 60);
    await act(async () => { root.unmount(); });
  });
});
