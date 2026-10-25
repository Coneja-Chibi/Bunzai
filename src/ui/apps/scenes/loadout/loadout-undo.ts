/**
 * Undoes an apply, in reverse order and through the same setter that wrote each unit.
 * Three-way, per unit: still what the apply wrote, so put the earlier value back; already the earlier value, so leave
 * it; anything else, so the person changed it since and it is left alone. One failure does not stop the others; the
 * receipt closes only when none failed, so a second Undo retries just what is still as the apply left it.
 */
import { deepEq } from "../../../../core/guards";
import { LOADOUT_UNITS, type LoadoutUnit } from "../../../../core/loadout-panels";
import type { LoadoutReceipt } from "../../../../studio/loadout-record";
import { toErrorMessage } from "../../../../error-message";
import { liveUnit, normUnit, writeUnit, type LoadoutApi } from "./loadout-units";

export interface UndoInput {
  api: LoadoutApi;
  receipt: LoadoutReceipt;
  /** The scene that is open: a receipt only undoes in the scene it was made in. */
  openChatId: string;
  /** The clock, as epoch ms. */
  now: number;
  /** A reply is open on the scene. */
  busy?: boolean;
}

export interface UndoRow {
  unit: LoadoutUnit;
  panels: string[];
  result: "restored" | "already-restored" | "left-alone" | "failed" | "skipped";
  error?: string;
}

export interface UndoResult {
  status: "refused" | "undone" | "partial";
  rows: UndoRow[];
  /** What each restoring setter answered, by unit, for the page to refresh from. */
  patch: Partial<Record<LoadoutUnit, unknown>>;
  error?: string;
  warning?: string;
}

const refuse = (error: string): UndoResult => ({ status: "refused", rows: [], patch: {}, error });

export async function undoReceipt({ api, receipt, openChatId, now, busy }: UndoInput): Promise<UndoResult> {
  if (receipt.chatId !== openChatId) return refuse("That receipt belongs to a different scene.");
  if (receipt.undoneAt !== undefined) return refuse("That loadout was already undone.");
  if (now >= receipt.undoUntil) return refuse("That loadout undo window has expired.");
  if (busy) return refuse("Wait for the reply to finish, then undo.");

  const live = await api.sceneSettings(receipt.chatId);
  const patch: UndoResult["patch"] = {};
  const rows: UndoRow[] = [];
  for (const unit of [...LOADOUT_UNITS].reverse()) {
    const row = receipt.rows.find((r) => r.unit === unit);
    if (!row) continue;
    const { panels } = row;
    if (row.state === "failed" || row.state === "not-attempted") {
      rows.push({ unit, panels, result: "skipped" });
      continue;
    }
    const current = liveUnit(live, unit);
    const before = normUnit(unit, receipt.before[unit]);
    if (!deepEq(current, normUnit(unit, receipt.after[unit]))) {
      rows.push({ unit, panels, result: deepEq(current, before) ? "already-restored" : "left-alone" });
      continue;
    }
    try {
      patch[unit] = await writeUnit(api, receipt.chatId, unit, before);
      rows.push({ unit, panels, result: "restored" });
    } catch (e) {
      rows.push({ unit, panels, result: "failed", error: toErrorMessage(e, "that setting could not be restored") });
    }
  }
  if (rows.some((r) => r.result === "failed")) return { status: "partial", rows, patch };
  try {
    await api.markLoadoutReceiptUndone(receipt.code);
    return { status: "undone", rows, patch };
  } catch {
    return { status: "undone", rows, patch, warning: "Undone, but the undo record could not be closed. Undo may still be offered." };
  }
}
