/** Covers overlapping metadata projections at the Library hook boundary. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { JSDOM } from "jsdom";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { PieceStore } from "../../_shared/piece-store";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { useLibraryPieceUpdates } from "./use-library-piece-updates";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { globals: { IS_REACT_ACT_ENVIRONMENT: true } });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const persona = (writeId: number): StudioEntitySummary => ({ kind: "persona", id: "a", name: "A", writeId, version: writeId, revision: `r${writeId}` });
const character = (writeId: number): StudioEntitySummary => ({ kind: "character", id: "b", name: "B", writeId, version: writeId, revision: `r${writeId}` });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

function mount(pieces: PieceStore, reads: Array<ReturnType<typeof deferred<unknown>>>) {
  const host = dom.window.document.createElement("div");
  const root = createRoot(host);
  let meta: Record<string, { brief?: string; pronouns?: string; sectionCount: number; hasLorebook: boolean }> = {};
  let publications = 0;
  const setMeta = (update: (old: typeof meta) => typeof meta): void => { publications++; meta = update(meta); };
  const ctx = { api: { getEntity: () => { const read = deferred<unknown>(); reads.push(read); return read.promise; } } } as unknown as AppContext;
  function Probe(): null {
    useLibraryPieceUpdates({ ctx, pieces, setEntities: () => undefined, setLore: () => undefined, setRegex: () => undefined, setPersona: setMeta, onReady: () => undefined });
    return null;
  }
  const render = async (): Promise<void> => { await act(async () => { root.render(<Probe />); }); };
  return { render, meta: () => meta, publications: () => publications, unmount: async () => { await act(async () => root.unmount()); } };
}

describe("Library metadata projection watermark", () => {
  test("an unrelated character receipt does not discard a still-current delayed persona projection", async () => {
    const pieces = new PieceStore();
    pieces.seed([persona(1), character(1)], 0);
    const reads: Array<ReturnType<typeof deferred<unknown>>> = [];
    const view = mount(pieces, reads);
    await view.render();
    expect(reads).toHaveLength(1);
    await act(async () => { pieces.accept(character(2)); await Promise.resolve(); });
    reads[0]!.resolve({ body: { brief: "kept A" } });
    await act(async () => { await reads[0]!.promise; await Promise.resolve(); });
    expect(view.meta().a?.brief).toBe("kept A");
    await view.unmount();
  });

  test("a same-key replacement rejects stale projection and publishes only the new identity", async () => {
    const pieces = new PieceStore();
    pieces.seed([persona(1)], 0);
    const reads: Array<ReturnType<typeof deferred<unknown>>> = [];
    const view = mount(pieces, reads);
    await view.render();
    await act(async () => { pieces.accept(persona(2)); await Promise.resolve(); });
    expect(reads).toHaveLength(2);
    reads[0]!.resolve({ body: { brief: "stale A" } });
    await act(async () => { await reads[0]!.promise; await Promise.resolve(); });
    expect(view.meta().a).toBeUndefined();
    reads[1]!.resolve({ body: { brief: "current A" } });
    await act(async () => { await reads[1]!.promise; await Promise.resolve(); });
    expect(view.meta().a?.brief).toBe("current A");
    await view.unmount();
  });
});

const count = 1000;
test(`initial metadata uses linear summary lookups at ${count} rows`, async () => {
  const pieces = new PieceStore();
  const rows = Array.from({ length: count }, (_, index) => ({ ...persona(1), id: `scale-${index}` }));
  pieces.seed(rows, 0);
  const snapshot = pieces.snapshot.bind(pieces);
  let lookups = 0;
  pieces.snapshot = (kind, id) => { lookups++; return snapshot(kind, id); };
  const reads: Array<ReturnType<typeof deferred<unknown>>> = [];
  const view = mount(pieces, reads);
  try {
    await view.render();
    expect(reads.length).toBe(count);
    await act(async () => {
      for (const read of reads) read.resolve({ body: { brief: "ready" } });
      await Promise.all(reads.map((read) => read.promise));
    });
    expect(lookups).toBeLessThanOrEqual(count * 4);
    expect(view.publications()).toBeLessThanOrEqual(2);
  } finally { await view.unmount(); }
});
