/**
 * Settings, Security, "Check my library": the calls to the care routes (src/ui/server-library-care.ts)
 * and the plain words of the report (design/wireframes/health-check/index.html): each finding's chip,
 * the buttons a repair gets, and the one-sentence summary of a clean or stopped check. Pure, so the wording
 * is tested without a browser.
 */
import { apiFetchJson } from "../../../_shared/api-fetch";

export type RepairKind = "roll-back" | "set-aside" | "re-sign" | "restore-snapshot";
export type FindingCode = "cell-unreadable" | "row-changed" | "row-missing" | "dangling" | "parts-missing" | "pointer-broken" | "file-damaged";
export interface Finding {
  id: string;
  code: FindingCode;
  item: string;
  cause: string;
  repairs: RepairKind[];
}
export type ScanJob =
  | { state: "none" }
  | { state: "running"; done: number; total: number }
  | { state: "failed"; error: string }
  | {
      state: "done";
      at: number;
      complete: boolean;
      stoppedAt: string | null;
      sealOwed: string | null;
      adopted: number;
      checked: Record<string, number>;
      findings: Finding[];
    };
export interface RepairOutcome {
  ok: true;
  cleared: boolean;
  summary: string;
}
export interface SetAsidePreview {
  rows: Record<string, number>;
  summary: string;
}

const post = <T>(path: string, body: unknown = {}): Promise<T> =>
  apiFetchJson<T>(`/api/library/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const healthApi = {
  job: () => apiFetchJson<ScanJob>("/api/library/health/scan", { requireToken: false }),
  start: () => post<ScanJob>("health/scan"),
  stop: () => post("health/stop"),
  preview: (findingId: string) => post<SetAsidePreview>("health/preview", { findingId }),
  repair: (findingId: string, kind: RepairKind, snapshotId?: string) => post<RepairOutcome>("health/repair", { findingId, kind, ...(snapshotId ? { snapshotId } : {}) }),
};

/** Damage that loses content shows the danger plate; the rest is the amber one. */
export const isDanger = (code: FindingCode): boolean => code !== "row-changed" && code !== "dangling";

export function chipOf(code: FindingCode): string {
  switch (code) {
    case "row-changed":
      return "Changed";
    case "dangling":
      return "Left over";
    case "file-damaged":
      return "The file";
    case "row-missing":
      return "Gone";
    default:
      return "Needs a choice";
  }
}

/** The button for one repair, in the wireframe's words, and whether it is the primary one. */
export function repairButton(kind: RepairKind, finding: Finding): { label: string; primary: boolean } {
  switch (kind) {
    case "roll-back":
      return { label: "Go back to the earlier version", primary: true };
    case "re-sign":
      return { label: "It looks right, keep it", primary: false };
    case "set-aside":
      return { label: "Set this aside", primary: false };
    case "restore-snapshot":
      return finding.code === "file-damaged" ? { label: "Choose a snapshot", primary: true } : { label: "Restore from a snapshot", primary: false };
  }
}

const total = (checked: Record<string, number>): number => Object.values(checked).reduce((a, b) => a + b, 0);
/** "Checked 9,120 rows just now. Everything opens and matches what was saved." */
export function allWell(job: Extract<ScanJob, { state: "done" }>): string {
  const rows = total(job.checked).toLocaleString("en-GB");
  const adopted = job.adopted > 0 ? " Rows saved before this check existed were marked as good." : "";
  return `Checked ${rows} saved rows just now. Everything opens and matches what was saved.${adopted}`;
}

/** The title of the card that says the check did not finish, or how much is left to decide. */
export function stoppedWords(stoppedAt: string | null): string {
  return stoppedAt ? `The check stopped at "${stoppedAt}"` : "The check stopped early";
}
