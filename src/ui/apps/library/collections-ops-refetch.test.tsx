/**
 * useCollections and R1: `ctx` rebuilds on every shell-store write
 * (a status message, a workbench tab...), so a load effect that depends on it re-downloads on each
 * one. `index.tsx`'s own load effect and `trash-panel.tsx`'s `useTrashCount` were fixed this way in
 * ecd0cc0; this is the same fix and the same shape of proof for `useCollections`, mounted the way
 * `use-reseed.test.tsx` mounts a bare hook (a `Probe` component, no full Library render needed).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { useCollections } from "./collections-ops";

// installDom's teardown saves and restores, not just sets: bun runs every file in one process, and
// index.tsx's own test.tsx (flushSync, no act()) shares this process. Leaving
// IS_REACT_ACT_ENVIRONMENT on for it once this file finishes turns its passive-effect updates into
// "not wrapped in act" warnings that have nothing to do with this file.
let dom: JSDOM;
let installed: InstalledDom;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8322/",
    globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
  dom = installed.dom;
});

afterAll(() => {
  return installed.teardown();
});

/** A bare-minimum ctx: only `api.collections` is ever called by this hook. */
function makeCtx(collections: () => Promise<{ collections: never[] }>): AppContext {
  return { api: { collections } } as unknown as AppContext;
}

async function mountProbe(ctx: AppContext): Promise<{ rerender: (next: AppContext) => Promise<void>; unmount: () => Promise<void> }> {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  function Probe({ ctx: c }: { ctx: AppContext }): null {
    useCollections(c);
    return null;
  }

  await act(async () => { root.render(<Probe ctx={ctx} />); });
  return {
    rerender: async (next) => { await act(async () => { root.render(<Probe ctx={next} />); }); },
    unmount: async () => { await act(async () => { root.unmount(); }); host.remove(); },
  };
}

describe("useCollections: R1, ctx churn alone must not reload", () => {
  test("mount plus 5 ctx rebuilds (a status message, a workbench tab...) still call collections() once", async () => {
    let calls = 0;
    const collections = async (): Promise<{ collections: never[] }> => { calls++; return { collections: [] }; };

    const probe = await mountProbe(makeCtx(collections));
    expect(calls).toBe(1);

    // Five ctx rebuilds with no real collections change, exactly what App.tsx's ctx useMemo
    // produces on every shell-store write. None of these should trigger another read.
    for (let i = 0; i < 5; i++) await probe.rerender(makeCtx(collections));

    expect(calls).toBe(1);
    await probe.unmount();
  });
});
