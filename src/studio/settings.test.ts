/** The settings document in the library: defaults, corruption, round trips, and queued patches. */
import { beforeEach, describe, expect, test } from "bun:test";
import { memoryStateStore } from "../stage/store/memory/state-store";
import type { StateStore } from "../stage/contracts/state-store";
import { SettingsStore } from "./settings";
import { StudioLockedError, StudioReadError } from "./errors";

describe("SettingsStore", () => {
  let state: StateStore;
  let store: SettingsStore;
  beforeEach(() => {
    state = memoryStateStore();
    store = new SettingsStore("/studio", () => state);
  });

  test("no document yields defaults", async () => {
    const s = await store.read();
    expect(s.setupComplete).toBe(false);
  });

  test("a corrupt document throws, and its text is kept", async () => {
    await state.write("settings", "NOT JSON{{{");
    await expect(store.read()).rejects.toBeInstanceOf(StudioReadError);
    expect(await state.read("settings")).toBe("NOT JSON{{{");
  });

  test("valid JSON of the wrong shape (an array, a bare string) also throws, even though parseSettings itself would silently default it", async () => {
    await state.write("settings", "[1,2,3]");
    await expect(store.read()).rejects.toBeInstanceOf(StudioReadError);
  });

  test("with no library open it refuses as locked, never reading a folder", async () => {
    await expect(new SettingsStore("/studio", () => null).read()).rejects.toBeInstanceOf(StudioLockedError);
  });

  test("a read failure that is NOT corrupt JSON (a busy database, a damaged cell) propagates as itself, never relabeled StudioReadError", async () => {
    const busy = new Error("db busy");
    const throwing: StateStore = { read: () => Promise.reject(busy), write: () => Promise.reject(busy) };
    await expect(new SettingsStore("/studio", () => throwing).read()).rejects.toBe(busy);
  });

  test("save + read round trip", async () => {
    await store.save({ setupComplete: true, theme: "stage" });
    const s = await store.read();
    expect(s.setupComplete).toBe(true);
    expect(s.theme).toBe("stage");
  });

  test("concurrent patches serialize without losing independent keys", async () => {
    await Promise.all([
      store.update({ theme: "stage" }),
      store.update({ firstDeck: "lorebook" }),
    ]);
    const s = await store.read();
    expect(s.theme).toBe("stage");
    expect(s.firstDeck).toBe("lorebook");
  });
});
