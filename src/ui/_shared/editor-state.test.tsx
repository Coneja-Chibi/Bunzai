/**
 * Coverage for the shared editor-state helpers: the revision-counter
 * dirty tracker's undo-to-original and async-save-race semantics, and the id-index map.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { deepEqual, useEditorRevision, useIdIndex, type EditorRevision } from "./editor-state";
import { installDom, type InstalledDom } from "./test-dom";

describe("deepEqual", () => {
  test("structural, not referential", () => {
    expect(deepEqual({ a: [1, { b: "x" }] }, { a: [1, { b: "x" }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });
});

let dom: JSDOM;
let installed: InstalledDom;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8473/",
    globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

interface Doc { name: string; items: { id: string; text: string }[] }

/** Mounts `useEditorRevision`, exposing its live return value through `box.api` (React state isn't
 * readable outside a render, so a test that needs the LATEST value after an act() reads this). */
function mountRevision(initial: Doc): { box: { api: EditorRevision<Doc> }; root: Root; host: HTMLElement } {
  const box: { api: EditorRevision<Doc> | null } = { api: null };
  function Probe(): null {
    box.api = useEditorRevision(initial);
    return null;
  }
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(<Probe />); });
  return { box: box as { api: EditorRevision<Doc> }, root, host };
}

describe("useEditorRevision", () => {
  test("clean on mount: body and baseline share a reference", () => {
    const initial: Doc = { name: "P", items: [] };
    const { box, root, host } = mountRevision(initial);
    expect(box.api.dirty).toBe(false);
    expect(box.api.body).toBe(box.api.baseline);
    act(() => root.unmount());
    host.remove();
  });

  test("an edit makes it dirty; undoing back to the exact saved text makes it clean again", () => {
    const initial: Doc = { name: "P", items: [{ id: "a", text: "hello" }] };
    const { box, root, host } = mountRevision(initial);

    act(() => { box.api.edit((d) => ({ ...d, items: d.items.map((i) => (i.id === "a" ? { ...i, text: "hello world" } : i)) })); });
    expect(box.api.dirty).toBe(true);

    // Typed back to the exact saved text: the same "edited back to original is clean" semantics
    // the old unconditional deepEq gave (task requirement - never a no-op save).
    act(() => { box.api.edit((d) => ({ ...d, items: d.items.map((i) => (i.id === "a" ? { ...i, text: "hello" } : i)) })); });
    expect(box.api.dirty).toBe(false);

    act(() => root.unmount());
    host.remove();
  });

  test("an edit during an in-flight save still counts as unsaved once the save resolves", () => {
    const initial: Doc = { name: "P", items: [{ id: "a", text: "v0" }] };
    const { box, root, host } = mountRevision(initial);

    // Simulate doSave(): capture the revision and the submitted snapshot BEFORE the "await".
    const submitted = box.api.body;
    const atRev = box.api.captureRevision();

    // More typing arrives while that save is "in flight".
    act(() => { box.api.edit((d) => ({ ...d, items: d.items.map((i) => (i.id === "a" ? { ...i, text: "v1" } : i)) })); });
    expect(box.api.dirty).toBe(true);

    // The save "resolves" and commits the OLD snapshot - must not clear the newer edit.
    act(() => { box.api.commit(submitted, atRev); });
    expect(box.api.dirty).toBe(true);
    expect(box.api.body.items[0]!.text).toBe("v1");

    act(() => root.unmount());
    host.remove();
  });

  test("a save that lands after a discard or reseed never reports the editor clean when it is not", () => {
    for (const drop of ["discard", "reseed"] as const) {
      const initial: Doc = { name: "v0", items: [] };
      const { box, root, host } = mountRevision(initial);
      act(() => { box.api.edit((d) => ({ ...d, name: "v1" })); });
      const submitted = box.api.body;
      const atRev = box.api.captureRevision();
      // While that save is in flight, the edits are dropped (take theirs, or a fresh read).
      act(() => { if (drop === "discard") box.api.discard(); else box.api.reseed({ name: "v0", items: [] }); });
      act(() => { box.api.commit(submitted, atRev); });
      // Disk now holds v1 and the screen shows v0: that difference is unsaved.
      expect(box.api.body.name).toBe("v0");
      expect(box.api.baseline.name).toBe("v1");
      expect(box.api.dirty).toBe(true);
      act(() => root.unmount());
      host.remove();
    }
  });

  test("commit with nothing typed since clears dirty", () => {
    const initial: Doc = { name: "P", items: [{ id: "a", text: "v0" }] };
    const { box, root, host } = mountRevision(initial);
    act(() => { box.api.edit((d) => ({ ...d, name: "P2" })); });
    expect(box.api.dirty).toBe(true);
    const submitted = box.api.body;
    const atRev = box.api.captureRevision();
    act(() => { box.api.commit(submitted, atRev); });
    expect(box.api.dirty).toBe(false);
    expect(box.api.baseline).toBe(submitted);
  });

  test("reseed takes a fresh read as the new clean state, discarding local edits", () => {
    const initial: Doc = { name: "P", items: [] };
    const { box, root, host } = mountRevision(initial);
    act(() => { box.api.edit((d) => ({ ...d, name: "edited" })); });
    expect(box.api.dirty).toBe(true);
    const fresh: Doc = { name: "fresh from disk", items: [] };
    act(() => { box.api.reseed(fresh); });
    expect(box.api.dirty).toBe(false);
    expect(box.api.body).toBe(fresh);
    expect(box.api.baseline).toBe(fresh);
    act(() => root.unmount());
    host.remove();
  });

  test("discard gives up local edits: body becomes the current baseline reference", () => {
    const initial: Doc = { name: "P", items: [] };
    const { box, root, host } = mountRevision(initial);
    const baselineRef = box.api.baseline;
    act(() => { box.api.edit((d) => ({ ...d, name: "edited" })); });
    expect(box.api.dirty).toBe(true);
    act(() => { box.api.discard(); });
    expect(box.api.dirty).toBe(false);
    expect(box.api.body).toBe(baselineRef);
    act(() => root.unmount());
    host.remove();
  });

  test("only the touched item's reference changes across an edit - proves the cheap per-block path", () => {
    const initial: Doc = { name: "P", items: [{ id: "a", text: "1" }, { id: "b", text: "2" }, { id: "c", text: "3" }] };
    const { box, root, host } = mountRevision(initial);
    const before = box.api.body.items;
    act(() => { box.api.edit((d) => ({ ...d, items: d.items.map((i) => (i.id === "b" ? { ...i, text: "2!" } : i)) })); });
    const after = box.api.body.items;
    expect(after[0]).toBe(before[0]); // untouched - SAME reference
    expect(after[2]).toBe(before[2]); // untouched - SAME reference
    expect(after[1]).not.toBe(before[1]); // touched - a new object
    act(() => root.unmount());
    host.remove();
  });
});

describe("useIdIndex", () => {
  function mountIndex<T>(items: readonly T[], getId: (item: T) => string): { map: ReadonlyMap<string, number>; root: Root; host: HTMLElement } {
    const box: { map: ReadonlyMap<string, number> | null } = { map: null };
    function Probe(): null {
      box.map = useIdIndex(items, getId);
      return null;
    }
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    act(() => { root.render(<Probe />); });
    return { map: box.map as ReadonlyMap<string, number>, root, host };
  }

  test("maps every id to its position", () => {
    const items = [{ id: "x" }, { id: "y" }, { id: "z" }];
    const { map, root, host } = mountIndex(items, (i) => i.id);
    expect(map.get("x")).toBe(0);
    expect(map.get("y")).toBe(1);
    expect(map.get("z")).toBe(2);
    expect(map.get("missing")).toBeUndefined();
    act(() => root.unmount());
    host.remove();
  });
});
