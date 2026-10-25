/**
 * The words the loadout surfaces say (loadout-text.ts): the receipt banner's three states, the Undo notice, and the
 * 15 minute window read off a clock the test owns.
 */
import { describe, expect, test } from "bun:test";
import { UNDO_MS } from "../../../../core/loadout-panels";
import type { LoadoutReceipt, ReceiptRow } from "../../../../studio/loadout-record";
import { bannerView, isOpen, minutesLeft, newReceiptCode, undoNotice } from "./loadout-text";

const T0 = 5_000_000;
const row = (unit: ReceiptRow["unit"], panels: string[], state: ReceiptRow["state"], error?: string): ReceiptRow => ({ unit, panels, state, ...(error ? { error } : {}) });
const receipt = (rows: ReceiptRow[], over: Partial<LoadoutReceipt> = {}): LoadoutReceipt => ({
  code: "LD-1", chatId: "c1", loadoutId: "l1", loadoutName: "Slow burn", appliedAt: T0, undoUntil: T0 + UNDO_MS, rows, before: {}, after: {}, ...over,
});

describe("the undo window", () => {
  test("is open until the 15 minutes are up, then closed, and never once undone", () => {
    const r = receipt([row("note", ["authorNote"], "applied")]);
    expect(isOpen(r, T0 + UNDO_MS - 1)).toBe(true);
    expect(isOpen(r, T0 + UNDO_MS)).toBe(false);
    expect(isOpen({ ...r, undoneAt: T0 + 5 }, T0 + 10)).toBe(false);
  });
  test("counts whole minutes left, rounding up", () => {
    const r = receipt([]);
    expect(minutesLeft(r, T0)).toBe(15);
    expect(minutesLeft(r, T0 + 60_001)).toBe(14);
    expect(minutesLeft(r, T0 + UNDO_MS + 1)).toBe(0);
  });
});

describe("the banner", () => {
  test("a clean apply reads RoleCall's words with the Bunraku note", () => {
    const v = bannerView(receipt([row("connection", ["mainModel"], "applied"), row("preset", ["preset", "samplers"], "applied")]), T0 + 1000);
    expect(v.tone).toBe("applied");
    expect(v.headline).toBe("Slow burn applied");
    expect(v.detail).toBe(" · 3 settings · receipt LD-1 · undo 15m");
    expect(v.lines).toEqual(["Active loadout is provenance, not a lock. Messages and takes were not touched."]);
    expect(v.undoable).toBe(true);
  });
  test("a part-way failure names the rows that applied and the rows that did not, and keeps Undo", () => {
    const v = bannerView(receipt([row("connection", ["mainModel"], "applied"), row("lore", ["lorebooks"], "failed", "lore refused"), row("note", ["authorNote"], "not-attempted")]), T0);
    expect(v.tone).toBe("partial");
    expect(v.headline).toBe("Slow burn partly applied");
    expect(v.detail).toBe(" · 1 of 3 settings · receipt LD-1 · undo 15m");
    expect(v.lines).toEqual(["Applied: Model and connection.", "Not applied: Lorebooks, Scene note. Undo puts back what did apply.", "lore refused"]);
    expect(v.undoable).toBe(true);
  });
  test("when the first row failed nothing applied, so there is no Undo to offer", () => {
    const v = bannerView(receipt([row("connection", ["mainModel"], "failed", "no such connection")]), T0);
    expect(v.tone).toBe("failed");
    expect(v.headline).toBe("Slow burn could not be applied");
    expect(v.lines).toEqual(["Not applied: Model and connection.", "no such connection"]);
    expect(v.undoable).toBe(false);
  });
  test("a row still pending (the receipt was never finished) counts as applied", () => {
    expect(bannerView(receipt([row("note", ["authorNote"], "pending")]), T0).tone).toBe("applied");
  });
});

describe("the Undo notice", () => {
  test("says what happened in RoleCall's words", () => {
    expect(undoNotice({ status: "undone", rows: [{ unit: "note", panels: ["authorNote"], result: "restored" }], patch: {} })).toEqual({ tone: "ok", text: "Loadout changes undone" });
    expect(undoNotice({ status: "undone", rows: [{ unit: "note", panels: ["authorNote"], result: "left-alone" }], patch: {} }).text).toBe("Loadout undo left 1 changed setting alone.");
    expect(undoNotice({ status: "undone", rows: [{ unit: "lore", panels: ["lorebooks"], result: "left-alone" }, { unit: "note", panels: ["authorNote"], result: "left-alone" }], patch: {} }).text).toBe("Loadout undo left 2 changed settings alone.");
    expect(undoNotice({ status: "partial", rows: [{ unit: "note", panels: ["authorNote"], result: "failed" }], patch: {} })).toEqual({ tone: "warn", text: "Some settings could not be restored: Scene note." });
    expect(undoNotice({ status: "refused", rows: [], patch: {}, error: "That loadout undo window has expired." })).toEqual({ tone: "error", text: "That loadout undo window has expired." });
  });
});

test("a receipt code is LD- and eight hex digits", () => {
  expect(newReceiptCode()).toMatch(/^LD-[0-9A-F]{8}$/);
});
