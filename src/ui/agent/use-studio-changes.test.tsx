/** Exercises editor freshness and stream state through one injected PieceStore owner. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../_shared/test-dom";
import { PieceStore } from "../_shared/piece-store";
import { api } from "../api";
import { useReopenOnStudioChange, useStudioChangeStream, useStudioChanges } from "./use-studio-changes";

let dom: JSDOM;
let installed: InstalledDom;
const live: FakeSource[] = [];
const readEmptyInventory = async (): Promise<{ entities: never[] }> => ({ entities: [] });
const quickRetry = (): number => 1;
type Listener = (event: MessageEvent<string>) => void;

class FakeSource {
  private readonly listeners = new Map<string, Listener[]>();
  closed = false;
  constructor(readonly url: string) { live.push(this); }
  addEventListener(type: string, fn: Listener): void {
    const at = this.listeners.get(type) ?? [];
    at.push(fn);
    this.listeners.set(type, at);
  }
  close(): void { this.closed = true; }
  emit(type: string, data?: unknown): void {
    if (this.closed) return;
    for (const fn of this.listeners.get(type) ?? []) fn({ data: JSON.stringify(data ?? {}) } as MessageEvent<string>);
  }
}

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8321/",
    globals: { EventSource: FakeSource, IS_REACT_ACT_ENVIRONMENT: true },
  });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const PIECE = { id: "astrolabe", kind: "preset", name: "Astrolabe", version: 1, writeId: 1, revision: "r1" };
interface Harness {
  readonly pieces: PieceStore;
  reopens(): number;
  setDirty(next: boolean): Promise<void>;
  change(kind: string): Promise<void>;
  externalChange(): Promise<void>;
  unmount(): Promise<void>;
}

async function mount(startDirty = false): Promise<Harness> {
  live.length = 0;
  const pieces = new PieceStore();
  pieces.seed([PIECE], 0);
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  let count = 0;
  function Probe({ dirty }: { dirty: boolean }): null {
    useStudioChangeStream(pieces, (url) => new FakeSource(url) as unknown as EventSource, readEmptyInventory as unknown as typeof api.studioInventory, quickRetry);
    useReopenOnStudioChange(pieces, PIECE, dirty, () => { count++; });
    return null;
  }
  const harness: Harness = {
    pieces,
    reopens: () => count,
    setDirty: async (dirty) => { await act(async () => { root.render(<Probe dirty={dirty} />); }); },
    change: async (kind) => {
      await act(async () => {
        if (kind === PIECE.kind) pieces.accept({ ...PIECE, version: pieces.snapshot(PIECE.kind, PIECE.id)!.version + 1, writeId: pieces.snapshot(PIECE.kind, PIECE.id)!.writeId + 1, revision: `r${pieces.snapshot(PIECE.kind, PIECE.id)!.writeId + 1}` });
        else pieces.accept({ kind, id: "other", name: "Other", version: 1, writeId: 1, revision: "other" });
      });
    },
    externalChange: async () => {
      const event = { kind: PIECE.kind, id: PIECE.id, action: "upsert" as const, version: 2, writeId: 2, revision: "r2", sequence: 1 };
      await act(async () => { await pieces.apply(event, async () => ({ ...PIECE, version: 2, writeId: 2, revision: "r2" })); });
    },
    unmount: async () => { await act(async () => { root.unmount(); }); host.remove(); },
  };
  await act(async () => { root.render(<Probe dirty={startDirty} />); });
  await act(async () => { live[0]?.emit("ready"); });
  return harness;
}

describe("reopening an accepted piece change", () => {
  test("the injected stream owner starts once and the initial seed is not a change", async () => {
    const h = await mount();
    expect(live).toHaveLength(1);
    expect(h.reopens()).toBe(0);
    await h.unmount();
    expect(live[0]?.closed).toBe(true);
  });
  test("a dropped source reconnects once and cleanup closes the replacement", async () => {
    const h = await mount();
    await act(async () => { live[0]!.emit("error"); await new Promise((resolve) => setTimeout(resolve, 5)); });
    expect(live).toHaveLength(2);
    expect(live[0]!.closed).toBe(true);
    await h.unmount();
    expect(live[1]!.closed).toBe(true);
  });
  test("a clean addressed piece reopens", async () => {
    const h = await mount();
    await h.change("preset");
    expect(h.reopens()).toBe(1);
    expect(h.pieces.streamState().externalVersion).toBe(0);
    expect(h.pieces.streamState().kinds).toEqual([]);
    await h.unmount();
  });
  test("an accepted stream receipt publishes its kind as an external notice", async () => {
    const h = await mount();
    await h.externalChange();
    expect(h.pieces.streamState().externalVersion).toBe(1);
    expect(h.pieces.streamState().kinds).toEqual(["preset"]);
    await h.unmount();
  });
  test("dirty work is kept and the accepted update reopens after save", async () => {
    const h = await mount(true);
    await h.change("preset");
    expect(h.reopens()).toBe(0);
    await h.setDirty(false);
    expect(h.reopens()).toBe(1);
    await h.setDirty(false);
    expect(h.reopens()).toBe(1);
    await h.unmount();
  });
  test("another piece kind does not reopen this editor", async () => {
    const h = await mount(true);
    await h.change("lorebook");
    await h.setDirty(false);
    expect(h.reopens()).toBe(0);
    await h.unmount();
  });
  test("a late accepted update cannot reopen after stream cleanup", async () => {
    const h = await mount();
    await h.unmount();
    await h.change("preset");
    expect(h.reopens()).toBe(0);
  });
});

test("the injected owner publishes lock and unlock state, including repeated lock notices", async () => {
  const pieces = new PieceStore();
  pieces.seed([PIECE], 0);
  const beforeLock = pieces.captureLifetime();
  const host = dom.window.document.createElement("div");
  const root = createRoot(host);
  const current: { value: ReturnType<typeof useStudioChanges> | null } = { value: null };
  function Probe(): null {
    useStudioChangeStream(pieces, (url) => new FakeSource(url) as unknown as EventSource, readEmptyInventory as unknown as typeof api.studioInventory, quickRetry);
    current.value = useStudioChanges(pieces);
    return null;
  }
  await act(async () => { root.render(<Probe />); });
  await act(async () => { live.at(-1)?.emit("ready"); });
  expect(current.value!.lockEvent).toBeNull();
  await act(async () => { live.at(-1)?.emit("lock"); });
  expect(current.value!.lockEvent).toEqual({ state: "locked", seq: 1 });
  await act(async () => { live.at(-1)?.emit("lock"); });
  expect(current.value!.lockEvent).toEqual({ state: "locked", seq: 2 });
  expect(pieces.listSnapshot()).toHaveLength(0);
  pieces.accept({ ...PIECE, version: 2, writeId: 2, revision: "late" }, beforeLock);
  expect(pieces.listSnapshot()).toHaveLength(0);
  await act(async () => { live.at(-1)?.emit("unlock"); });
  expect(current.value!.lockEvent).toEqual({ state: "unlocked", seq: 3 });
  await act(async () => { live.at(-1)?.emit("lock"); });
  expect(current.value!.lockEvent).toEqual({ state: "locked", seq: 4 });
  await act(async () => { root.unmount(); });
});
