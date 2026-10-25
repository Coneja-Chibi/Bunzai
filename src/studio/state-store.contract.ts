/**
 * Contracts for the studio's two families of small state documents, asserted once and run by each
 * member against its own data. A tolerant store (collections, graveyard) reads a corrupt file as
 * empty, refuses with no library open, lets a busy database propagate without writing, and queues
 * edits. A document library (guides, loadouts) refuses bad input without touching the document,
 * says not-found for a missing or deleted id, and keeps overlapping saves.
 */
import { describe, expect, test } from "bun:test";
import type { StateKey, StateStore } from "../stage/contracts/state-store";
import { StudioLockedError, StudioNotFoundError, StudioValidationError } from "./errors";

export interface TolerantStoreSpec<Doc> {
  name: string;
  /** A fresh empty state store (the memory one, supplied by the test so this file imports no backend). */
  newState: () => StateStore;
  /** The state key the document lives under. */
  key: StateKey;
  open: (io: () => StateStore | null) => { read: () => Promise<Doc>; edit: (fn: (current: Doc) => Doc) => Promise<unknown> };
  empty: Doc;
  /** A pure edit that adds one distinguishable item, numbered from 1. */
  add: (current: Doc, n: number) => Doc;
  /** The numbers of the items the document holds. */
  held: (doc: Doc) => number[];
}

export function tolerantStoreContract<Doc>(spec: TolerantStoreSpec<Doc>): void {
  const fresh = (text?: string) => {
    const state = spec.newState();
    if (text !== undefined) void state.write(spec.key, text);
    return { state, store: spec.open(() => state) };
  };
  describe(`${spec.name} tolerant store contract`, () => {
    test("no document reads as empty, a corrupt one costs the data and never the studio", async () => {
      expect((await fresh().store.read()) as unknown).toEqual(spec.empty);
      expect((await fresh("{not json at all").store.read()) as unknown).toEqual(spec.empty);
    });

    test("an edit lands in the library's document under its key", async () => {
      const { state, store } = fresh();
      await store.edit((c) => spec.add(c, 1));
      expect(await state.read(spec.key)).toBeTruthy();
      expect(spec.held(await store.read())).toEqual([1]);
    });

    test("with no library open it refuses as locked, never silently returning empty", async () => {
      await expect(spec.open(() => null).read()).rejects.toBeInstanceOf(StudioLockedError);
    });

    test("a read failure that is not corrupt JSON propagates, and an edit built on it never writes", async () => {
      const busy = new Error("db busy");
      let wrote = false;
      const throwing: StateStore = { read: () => Promise.reject(busy), write: () => { wrote = true; return Promise.resolve(); } };
      const store = spec.open(() => throwing);
      await expect(store.read()).rejects.toBe(busy);
      await expect(store.edit((c) => spec.add(c, 1))).rejects.toBe(busy);
      expect(wrote).toBe(false);
    });

    test("concurrent edits do not lose each other, and a failed edit does not stall the ones after it", async () => {
      const { store } = fresh();
      await Promise.all([1, 2, 3].map((n) => store.edit((c) => spec.add(c, n))));
      expect(spec.held(await store.read()).sort()).toEqual([1, 2, 3]);
      await expect(store.edit(() => { throw new Error("bad edit"); })).rejects.toThrow("bad edit");
      await store.edit((c) => spec.add(c, 4));
      expect(spec.held(await store.read()).sort()).toEqual([1, 2, 3, 4]);
    });
  });
}

export interface LibrarySpec {
  name: string;
  newState: () => StateStore;
  key: StateKey;
  /** Saves raw input as a new row, or an edit of the row whose id it carries. */
  save: (state: StateStore, raw: unknown, now: number, ids: () => string) => Promise<{ id: string }>;
  list: (state: StateStore) => Promise<{ id: string }[]>;
  remove: (state: StateStore, id: string, now: number) => Promise<unknown>;
  /** Valid raw input for a new row, distinguishable by n. */
  good: (n: number) => Record<string, unknown>;
  bad: readonly unknown[];
}

export function documentLibraryContract(spec: LibrarySpec): void {
  const ids = () => {
    let n = 0;
    return () => `x${++n}`;
  };
  describe(`${spec.name} document library contract`, () => {
    test("bad input is refused with a validation error and changes nothing", async () => {
      const state = spec.newState();
      const next = ids();
      await spec.save(state, spec.good(1), 100, next);
      const before = await state.read(spec.key);
      for (const raw of spec.bad) await expect(spec.save(state, raw, 5, next)).rejects.toBeInstanceOf(StudioValidationError);
      expect(await state.read(spec.key)).toBe(before);
    });

    test("editing a row that is gone, or was deleted, is not found", async () => {
      const state = spec.newState();
      const row = await spec.save(state, spec.good(1), 100, ids());
      await expect(spec.save(state, { ...spec.good(1), id: "nope" }, 5, ids())).rejects.toBeInstanceOf(StudioNotFoundError);
      await spec.remove(state, row.id, 200);
      await expect(spec.save(state, { ...spec.good(1), id: row.id }, 5, ids())).rejects.toBeInstanceOf(StudioNotFoundError);
    });

    test("saves that overlap are both kept", async () => {
      const state = spec.newState();
      const next = ids();
      await Promise.all([spec.save(state, spec.good(1), 1, next), spec.save(state, spec.good(2), 2, next)]);
      expect(await spec.list(state)).toHaveLength(2);
    });
  });
}
