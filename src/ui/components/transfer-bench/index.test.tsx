/** Both transfer columns are windowed: 500 items on one side mount a few rows. */
import { afterAll, beforeAll, describe, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expectWindowed, flushTasks, installDom, type InstalledDom } from "../../_shared/test-dom";
import { TransferBench } from "./index";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { observers: true, pretendToBeVisual: true, globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

describe("TransferBench", () => {
  test("500 items in a column mount fewer than 60 rows", async () => {
    const left = Array.from({ length: 500 }, (_, i) => ({ id: `e${String(i)}`, label: `Entry ${String(i)}` }));
    const host = installed.dom.window.document.createElement("div");
    installed.dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    const noop = (): void => undefined;
    await act(async () => { root.render(<TransferBench leftTitle="Book" rightTitle="New" left={left} right={[]} name="" onName={noop} onMoveToRight={noop} onMoveToLeft={noop} onApply={noop} onCancel={noop} />); });
    await act(async () => { await flushTasks(6); });
    expectWindowed(host, "[data-index]", 500, 60);
    await act(async () => { root.unmount(); });
  });
});
