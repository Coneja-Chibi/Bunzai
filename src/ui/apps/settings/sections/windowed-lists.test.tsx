/** The Copies list and the health report window their rows: 500 of either mount a few. */
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { act, createElement, type JSX } from "react";
import { createRoot, type Root } from "react-dom/client";
import { expectWindowed, flushTasks, installDom } from "../../../_shared/test-dom";
import backups from "./backups";
import { HealthReport } from "./health-report";

const installed = installDom('<!doctype html><div id="root"></div>', { observers: true, pretendToBeVisual: true, extraGlobals: ["Event", "HTMLDialogElement", "HTMLButtonElement"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
afterAll(() => installed.teardown());
const realFetch = globalThis.fetch;
let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; globalThis.fetch = realFetch; });

const serve = (answer: (url: string) => unknown): void => {
  globalThis.fetch = (async (input: RequestInfo | URL) => new Response(JSON.stringify(answer(String(input))), { headers: { "content-type": "application/json" } })) as typeof fetch;
};
async function mount(component: (props: never) => JSX.Element): Promise<HTMLElement> {
  const host = document.getElementById("root")!;
  root = createRoot(host);
  await act(async () => { root!.render(createElement(component as () => JSX.Element)); });
  await act(async () => { await flushTasks(); });
  return host;
}

describe("windowed settings lists", () => {
  test("500 copies, once all are shown, mount fewer than 60 rows", async () => {
    const snapshots = Array.from({ length: 500 }, (_, i) => ({ id: `s${String(i)}`, kind: "auto", takenAt: 1_700_000_000_000 - i * 3_600_000, bytes: 1000 }));
    serve(() => ({ unlocked: true, snapshots, needsWords: false, lastError: null, last: snapshots[0], totalBytes: 500_000, manual: { count: 0, cap: 5 } }));
    const host = await mount(backups.Component);
    const all = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Show all copies"))!;
    await act(async () => { all.click(); });
    await act(async () => { await flushTasks(); });
    expectWindowed(host, "[data-index]", 500, 60);
  });

  test("500 findings mount fewer than 60 notices", async () => {
    const findings = Array.from({ length: 500 }, (_, i) => ({ id: `f${String(i)}`, code: "row-changed", item: `Item ${String(i)}`, cause: "changed", repairs: [] }));
    serve(() => ({ state: "done", at: 1, complete: true, stoppedAt: null, sealOwed: null, adopted: 0, checked: {}, findings }));
    const host = await mount(HealthReport);
    expectWindowed(host, "[data-index]", 500, 60);
  });
});
