/**
 * The words the loadout surfaces say, and the clock rules behind them (RoleCall's LoadoutReceiptBanner.tsx, receipt.ts
 * `UNDO_MS`): what the receipt banner reads in its three states, the Undo notice, and the 15 minute window. Pure; the
 * banner and the bar only place what this returns.
 */
import { PANEL_META } from "../../../../core/loadout-panels";
import { plural } from "../../../../core/text";
import type { LoadoutReceipt } from "../../../../studio/loadout-record";
import type { UndoResult } from "./loadout-undo";

export const labelOf = (panel: string): string => (Object.hasOwn(PANEL_META, panel) ? PANEL_META[panel as keyof typeof PANEL_META].label : panel);
const names = (panels: string[]): string => panels.map(labelOf).join(", ");

/** Undo is offered from the apply until `undoUntil`, and never after it was undone. */
export const isOpen = (r: LoadoutReceipt, now: number): boolean => r.undoneAt === undefined && now < r.undoUntil;
export const minutesLeft = (r: LoadoutReceipt, now: number): number => Math.max(0, Math.ceil((r.undoUntil - now) / 60_000));

/** `LD-` and eight hex digits (RoleCall: `RC-LD-` and eight). */
export function newReceiptCode(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(4));
  return `LD-${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export interface BannerView {
  tone: "applied" | "partial" | "failed";
  headline: string;
  detail: string;
  lines: string[];
  undoable: boolean;
}

/** A row still pending (the apply ran but its receipt was never finished) counts as applied: it was written. */
export function bannerView(r: LoadoutReceipt, now: number): BannerView {
  const done = r.rows.filter((x) => x.state === "applied" || x.state === "pending").flatMap((x) => x.panels);
  const left = r.rows.filter((x) => x.state === "failed" || x.state === "not-attempted").flatMap((x) => x.panels);
  const reason = r.rows.find((x) => x.state === "failed")?.error;
  const tail = ` · receipt ${r.code} · undo ${minutesLeft(r, now)}m`;
  if (done.length === 0) {
    return { tone: "failed", headline: `${r.loadoutName} could not be applied`, detail: ` · receipt ${r.code}`, lines: [`Not applied: ${names(left)}.`, ...(reason ? [reason] : [])], undoable: false };
  }
  if (left.length === 0) {
    return { tone: "applied", headline: `${r.loadoutName} applied`, detail: ` · ${plural(done.length, "setting")}${tail}`, lines: ["Active loadout is provenance, not a lock. Messages and takes were not touched."], undoable: true };
  }
  return {
    tone: "partial", headline: `${r.loadoutName} partly applied`, detail: ` · ${done.length} of ${done.length + left.length} settings${tail}`,
    lines: [`Applied: ${names(done)}.`, `Not applied: ${names(left)}. Undo puts back what did apply.`, ...(reason ? [reason] : [])], undoable: true,
  };
}

export interface Notice {
  tone: "ok" | "warn" | "error";
  text: string;
}

/** What Undo reports, in RoleCall's words (ApplyLoadoutFromScene.tsx:242-342). */
export function undoNotice(r: UndoResult): Notice {
  if (r.status === "refused") return { tone: "error", text: r.error ?? "Could not undo this loadout." };
  if (r.status === "partial") return { tone: "warn", text: `Some settings could not be restored: ${names(r.rows.filter((x) => x.result === "failed").flatMap((x) => x.panels))}.` };
  const kept = r.rows.filter((x) => x.result === "left-alone").length;
  const text = kept ? `Loadout undo left ${plural(kept, "changed setting")} alone.` : "Loadout changes undone";
  return { tone: kept || r.warning ? "warn" : "ok", text: r.warning ? `${text} ${r.warning}` : text };
}
