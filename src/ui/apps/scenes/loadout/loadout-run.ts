/**
 * Applies a loadout to a scene: plan from the settings the store holds now,
 * save the receipt, then write each unit through its own setter in the fixed order. The first failure stops the run;
 * nothing is rolled back (Undo is the one way back), and every row is reported as applied, failed or not attempted.
 */
import { UNDO_MS, type LoadoutUnit } from "../../../../core/loadout-panels";
import type { JsonValue } from "../../../../stage/contracts/chat-store";
import type { LoadoutReceipt, LoadoutRecord, ReceiptRow } from "../../../../studio/loadout-record";
import { toErrorMessage } from "../../../../error-message";
import { planLoadout, type PlanRow, type ReportState, type Strategies } from "./loadout-plan";
import { writeUnit, type LoadoutApi } from "./loadout-units";

export interface RunInput {
  api: LoadoutApi;
  chatId: string;
  loadout: Pick<LoadoutRecord, "id" | "name" | "panels" | "values">;
  strategies?: Strategies;
  /** The clock, as epoch ms. */
  now: number;
  /** Makes a receipt code, unique in the library. */
  newCode: () => string;
  /** A reply is open on the scene: refuse before reading or writing. */
  busy?: boolean;
}

export interface ReportRow extends Omit<PlanRow, "state"> {
  state: ReportState;
}

export interface RunResult {
  status: "busy" | "nothing-to-change" | "not-saved" | "applied" | "partial" | "failed";
  rows: ReportRow[];
  receipt?: LoadoutReceipt;
  /** What each written unit's setter answered, by unit, for the page to refresh from. */
  patch: Partial<Record<LoadoutUnit, unknown>>;
  error?: string;
  warning?: string;
}

const NOT_SAVED = "Nothing was changed because the undo record could not be saved.";
const NOT_FINISHED = "Applied. The undo record could not be updated; Undo may skip some rows.";

export async function runLoadout(input: RunInput): Promise<RunResult> {
  const { api, chatId, loadout, now } = input;
  if (input.busy) return { status: "busy", rows: [], patch: {} };
  const plan = planLoadout(loadout, await api.sceneSettings(chatId), input.strategies);
  const report = (unitStates: Map<LoadoutUnit, { state: ReportState; why?: string }>): ReportRow[] =>
    plan.rows.map((row) => {
      const unit = plan.units.find((u) => u.panels.includes(row.panel));
      const done = unit && unitStates.get(unit.unit);
      return { ...row, state: row.state === "will-change" ? done?.state ?? "not-attempted" : row.state, ...(done?.why ? { why: done.why } : {}) };
    });
  if (plan.units.length === 0) return { status: "nothing-to-change", rows: report(new Map()), patch: {} };

  const pending: ReceiptRow[] = plan.units.map((u) => ({ unit: u.unit, panels: u.panels, state: "pending" }));
  const draft: LoadoutReceipt = {
    code: input.newCode(), chatId, loadoutId: loadout.id, loadoutName: loadout.name, appliedAt: now, undoUntil: now + UNDO_MS, rows: pending,
    before: Object.fromEntries(plan.units.map((u) => [u.unit, u.before])) as Record<string, JsonValue>,
    after: Object.fromEntries(plan.units.map((u) => [u.unit, u.after])) as Record<string, JsonValue>,
  };
  let saved: LoadoutReceipt;
  try {
    saved = await api.saveLoadoutReceipt(draft);
  } catch {
    return { status: "not-saved", rows: report(new Map()), patch: {}, error: NOT_SAVED };
  }

  const patch: RunResult["patch"] = {};
  const states = new Map<LoadoutUnit, { state: ReportState; why?: string }>();
  const rows: ReceiptRow[] = [];
  let stopped = false;
  for (const { unit, panels, after } of plan.units) {
    if (stopped) {
      states.set(unit, { state: "not-attempted" });
      rows.push({ unit, panels, state: "not-attempted" });
      continue;
    }
    try {
      patch[unit] = await writeUnit(api, chatId, unit, after);
      states.set(unit, { state: "applied" });
      rows.push({ unit, panels, state: "applied" });
    } catch (e) {
      stopped = true;
      const error = toErrorMessage(e, "that setting could not be written");
      states.set(unit, { state: "failed", why: error });
      rows.push({ unit, panels, state: "failed", error });
    }
  }

  let receipt: LoadoutReceipt = { ...saved, rows };
  let warning: string | undefined;
  try {
    receipt = await api.finishLoadoutReceipt(saved.code, rows);
  } catch {
    warning = NOT_FINISHED;
  }
  const out = report(states);
  const status = !out.some((r) => r.state === "failed") ? "applied" : rows.some((r) => r.state === "applied") ? "partial" : "failed";
  return { status, rows: out, receipt, patch, ...(warning ? { warning } : {}) };
}
