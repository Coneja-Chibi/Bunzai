/**
 * The loadout library and its receipts (studio/loadouts.ts): a sealed document in the library's state, a delete that
 * keeps the record and a restore that brings it back, a cap that refuses instead of evicting, panels this build does
 * not know kept whole, and a receipt whose 15 minutes the store's own clock decides.
 */
import { describe, expect, test } from "bun:test";
import { LOADOUT_CAP, UNDO_MS } from "../core/loadout-panels";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { StudioConflictError, StudioNotFoundError, StudioValidationError } from "./errors";

import { deleteLoadout, finishReceipt, latestOpenReceipt, listLoadouts, markUndone, restoreLoadout, saveLoadout, saveReceipt } from "./loadouts";
import type { LoadoutReceipt } from "./loadout-record";
import { documentLibraryContract } from "./state-store.contract";

const ids = () => {
  let n = 0;
  return () => `l${++n}`;
};
const fields = { name: "Slow burn", values: { guides: ["g1"], authorNote: null } };

describe("saving loadouts", () => {
  test("a new loadout is stored with its derived panels and round trips through a fresh store reader", async () => {
    const state = memoryStateStore();
    const saved = await saveLoadout(state, fields, 100, ids());
    expect(saved).toEqual({ id: "l1", name: "Slow burn", createdAt: 100, updatedAt: 100, panels: ["authorNote", "guides"], values: { authorNote: null, guides: ["g1"] } });
    expect(await listLoadouts(state)).toEqual([saved]);
    expect(JSON.parse((await state.read("loadouts"))!)).toMatchObject({ version: 1, loadouts: [saved], receipts: [] });
  });

  test("saving with an id replaces name and values, keeps the creation time, keeps the others, and moves it first", async () => {
    const state = memoryStateStore();
    const next = ids();
    const a = await saveLoadout(state, fields, 100, next);
    await saveLoadout(state, { name: "B", values: {} }, 200, next);
    const edited = await saveLoadout(state, { id: a.id, name: "Renamed", values: { persona: "p" } }, 300, next);
    expect(edited).toEqual({ id: "l1", name: "Renamed", createdAt: 100, updatedAt: 300, panels: ["persona"], values: { persona: "p" } });
    expect((await listLoadouts(state)).map((l) => l.id)).toEqual(["l1", "l2"]);
  });

  test("a panel this build does not know survives a save, a delete, a restore and a re-read untouched", async () => {
    const state = memoryStateStore();
    const values = { guides: ["g1"], zebra: { deep: [1, { x: null }] }, dm: { mode: "later" } };
    const saved = await saveLoadout(state, { name: "Future", values }, 1, ids());
    expect(saved.values).toEqual(values);
    expect(saved.panels).toEqual(["dm", "guides", "zebra"]);
    await deleteLoadout(state, saved.id, 2);
    await restoreLoadout(state, saved.id);
    expect((await listLoadouts(state))[0]!.values).toEqual(values);
  });
});

describe("the cap", () => {
  const fill = async (n: number) => {
    const state = memoryStateStore();
    const next = ids();
    for (let i = 0; i < n; i++) await saveLoadout(state, { name: `L${i}`, values: {} }, i, next);
    return { state, next };
  };

  test("the 101st save is refused with a plain message and nothing is evicted (RoleCall silently hard-deletes its oldest)", async () => {
    const { state, next } = await fill(LOADOUT_CAP);
    const before = await state.read("loadouts");
    const refused = await saveLoadout(state, { name: "One too many", values: {} }, 999, next).then(() => null, (e: unknown) => e);
    expect(refused).toBeInstanceOf(StudioConflictError);
    expect((refused as Error).message).toBe("You have 100 loadouts. Delete one first.");
    expect(await state.read("loadouts")).toBe(before);
    expect(await listLoadouts(state)).toHaveLength(LOADOUT_CAP);
  });

  test("changing an existing loadout at the cap still works, and a delete frees a place", async () => {
    const { state, next } = await fill(LOADOUT_CAP);
    const [first] = await listLoadouts(state);
    await saveLoadout(state, { id: first!.id, name: "Changed", values: {} }, 500, next);
    await deleteLoadout(state, first!.id, 600);
    await saveLoadout(state, { name: "Fits now", values: {} }, 700, next);
    expect(await listLoadouts(state)).toHaveLength(LOADOUT_CAP);
  });

  test("a restore that would pass the cap is refused", async () => {
    const { state, next } = await fill(LOADOUT_CAP);
    const [first] = await listLoadouts(state);
    await deleteLoadout(state, first!.id, 600);
    await saveLoadout(state, { name: "Took the place", values: {} }, 700, next);
    await expect(restoreLoadout(state, first!.id)).rejects.toBeInstanceOf(StudioConflictError);
    expect(await listLoadouts(state, true)).toHaveLength(1);
  });
});

describe("deleting and restoring", () => {
  test("a delete leaves the live list, the record stays, and a restore brings it back unchanged", async () => {
    const state = memoryStateStore();
    const l = await saveLoadout(state, fields, 100, ids());
    expect(await deleteLoadout(state, l.id, 200)).toBe(true);
    expect(await deleteLoadout(state, l.id, 300)).toBe(false);
    expect(await listLoadouts(state)).toEqual([]);
    expect(await listLoadouts(state, true)).toEqual([{ ...l, deletedAt: 200 }]);
    expect(JSON.parse((await state.read("loadouts"))!).loadouts).toEqual([{ ...l, deletedAt: 200 }]);
    expect(await restoreLoadout(state, l.id)).toEqual(l);
    expect(await listLoadouts(state)).toEqual([l]);
    expect(await listLoadouts(state, true)).toEqual([]);
  });

  test("restoring a loadout that is live or never existed is not found", async () => {
    const state = memoryStateStore();
    const l = await saveLoadout(state, fields, 100, ids());
    await expect(restoreLoadout(state, l.id)).rejects.toBeInstanceOf(StudioNotFoundError);
    await expect(restoreLoadout(state, "nope")).rejects.toBeInstanceOf(StudioNotFoundError);
  });
});

describe("a document that cannot be read", () => {
  const live = { id: "x", name: "N", createdAt: 1, updatedAt: 1, panels: [], values: {} };
  test("is refused, never read as empty, and no write overwrites it", async () => {
    const broken = ["{broken", "[]", JSON.stringify({ version: 1 }), JSON.stringify({ version: 2, loadouts: [], receipts: [] }), JSON.stringify({ version: 1, loadouts: [{ id: "x" }], receipts: [] }), JSON.stringify({ version: 1, loadouts: [{ ...live, name: "" }], receipts: [] }), JSON.stringify({ version: 1, loadouts: [], receipts: [{ code: "c" }] })];
    for (const text of broken) {
      const state = memoryStateStore();
      await state.write("loadouts", text);
      await expect(listLoadouts(state)).rejects.toBeInstanceOf(StudioValidationError);
      await expect(saveLoadout(state, fields, 1, ids())).rejects.toBeInstanceOf(StudioValidationError);
      await expect(latestOpenReceipt(state, "c", 1)).rejects.toBeInstanceOf(StudioValidationError);
      expect(await state.read("loadouts")).toBe(text);
    }
  });
});

describe("receipts", () => {
  const receipt = (over: Partial<LoadoutReceipt> = {}): Record<string, unknown> => ({
    code: "LD-1", chatId: "c1", loadoutId: "l1", loadoutName: "Slow burn", appliedAt: 0, undoUntil: 0,
    rows: [{ unit: "lore", panels: ["lorebooks"], state: "pending" }, { unit: "note", panels: ["authorNote"], state: "pending" }],
    before: { lore: null, note: null }, after: { lore: { added: ["b"], off: [] }, note: null }, ...over,
  });
  const T0 = 1_000_000;

  test("the store sets the times: applied now, undo 15 minutes later, whatever the caller claimed", async () => {
    const state = memoryStateStore();
    const saved = await saveReceipt(state, receipt({ appliedAt: 5, undoUntil: 9e12 }), T0);
    expect(saved).toMatchObject({ code: "LD-1", appliedAt: T0, undoUntil: T0 + UNDO_MS });
    expect(await latestOpenReceipt(state, "c1", T0 + 1)).toEqual(saved);
  });

  test("finishing patches the rows only, and an unknown code is not found", async () => {
    const state = memoryStateStore();
    const saved = await saveReceipt(state, receipt(), T0);
    const rows: LoadoutReceipt["rows"] = [{ unit: "lore", panels: ["lorebooks"], state: "applied" }, { unit: "note", panels: ["authorNote"], state: "failed", error: "boom" }];
    const done = await finishReceipt(state, "LD-1", rows);
    expect(done).toEqual({ ...saved, rows });
    await expect(finishReceipt(state, "nope", rows)).rejects.toBeInstanceOf(StudioNotFoundError);
    await expect(finishReceipt(state, "LD-1", [{ unit: "zzz", panels: [], state: "applied" }])).rejects.toBeInstanceOf(StudioValidationError);
  });

  test("the same code twice is refused", async () => {
    const state = memoryStateStore();
    await saveReceipt(state, receipt(), T0);
    await expect(saveReceipt(state, receipt(), T0 + 1)).rejects.toBeInstanceOf(StudioConflictError);
  });

  test("undone inside the window is closed; undone again, or after the window, is refused", async () => {
    const state = memoryStateStore();
    await saveReceipt(state, receipt(), T0);
    const done = await markUndone(state, "LD-1", T0 + UNDO_MS - 1);
    expect(done.undoneAt).toBe(T0 + UNDO_MS - 1);
    expect(await latestOpenReceipt(state, "c1", T0 + 2)).toBeNull();
    const again = await markUndone(state, "LD-1", T0 + 5).then(() => null, (e: unknown) => e);
    expect(again).toBeInstanceOf(StudioConflictError);
    await saveReceipt(state, receipt({ code: "LD-2" }), T0 + 10);
    const late = await markUndone(state, "LD-2", T0 + 10 + UNDO_MS).then(() => null, (e: unknown) => e);
    expect(late).toBeInstanceOf(StudioConflictError);
    expect((late as Error).message).toBe("That loadout undo window has expired.");
    await expect(markUndone(state, "nope", T0)).rejects.toBeInstanceOf(StudioNotFoundError);
  });

  test("the open receipt for a scene is its newest unexpired one, and another scene's is not offered", async () => {
    const state = memoryStateStore();
    await saveReceipt(state, receipt({ code: "A" }), T0);
    await saveReceipt(state, receipt({ code: "B" }), T0 + 1000);
    await saveReceipt(state, receipt({ code: "C", chatId: "other" }), T0 + 2000);
    expect((await latestOpenReceipt(state, "c1", T0 + 3000))?.code).toBe("B");
    expect((await latestOpenReceipt(state, "other", T0 + 3000))?.code).toBe("C");
    expect(await latestOpenReceipt(state, "c1", T0 + 1000 + UNDO_MS)).toBeNull();
  });

  test("a receipt survives a fresh reader of the same stored text", async () => {
    const state = memoryStateStore();
    const saved = await saveReceipt(state, receipt(), T0);
    const copy = memoryStateStore();
    await copy.write("loadouts", (await state.read("loadouts"))!);
    expect(await latestOpenReceipt(copy, "c1", T0 + 1)).toEqual(saved);
  });

  test("closed receipts older than a day are dropped, at most 20 are kept, and an open receipt is never dropped", async () => {
    const state = memoryStateStore();
    const DAY = 24 * 60 * 60 * 1000;
    await saveReceipt(state, receipt({ code: "old" }), T0);
    await markUndone(state, "old", T0 + 1);
    await saveReceipt(state, receipt({ code: "recent" }), T0 + DAY);
    expect(JSON.parse((await state.read("loadouts"))!).receipts.map((r: LoadoutReceipt) => r.code)).toEqual(["recent"]);

    const many = memoryStateStore();
    for (let i = 0; i < 25; i++) await saveReceipt(many, receipt({ code: `r${i}` }), T0 + i);
    const kept = JSON.parse((await many.read("loadouts"))!).receipts as LoadoutReceipt[];
    expect(kept).toHaveLength(25);
    for (let i = 0; i < 25; i++) await markUndone(many, `r${i}`, T0 + 100);
    await saveReceipt(many, receipt({ code: "open" }), T0 + 200);
    const after = JSON.parse((await many.read("loadouts"))!).receipts as LoadoutReceipt[];
    expect(after).toHaveLength(20);
    expect(after.map((r) => r.code)).toContain("open");
    expect(after.map((r) => r.code)).not.toContain("r0");
    expect(after.map((r) => r.code)).toContain("r24");
  });

  test("a receipt write leaves the loadouts beside it alone", async () => {
    const state = memoryStateStore();
    const l = await saveLoadout(state, fields, 100, ids());
    await saveReceipt(state, receipt(), T0);
    expect(await listLoadouts(state)).toEqual([l]);
  });
});

documentLibraryContract({
  name: "loadouts",
  newState: memoryStateStore,
  key: "loadouts",
  save: saveLoadout,
  list: listLoadouts,
  remove: deleteLoadout,
  good: (n) => ({ name: `Loadout ${n}`, values: {} }),
  bad: [{ name: "", values: {} }, { name: "x", values: { guides: "g1" } }, { name: "x", values: {}, extra: 1 }, { id: 5, name: "x", values: {} }, "x", null],
});
