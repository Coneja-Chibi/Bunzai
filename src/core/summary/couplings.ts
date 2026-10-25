/**
 * The couplings between the chat summary's settings (RoleCall `MemoryPanel.tsx`, rc-parity 08), each a few keys of ChatStore rule 45's settings: switching automation on from an interval of 0 gives it 60
 * so it never reads On while it cannot run, typing an interval turns automation on or off, and turning on Hide messages already covered picks a Keep recent. One module for the Memory tab and
 * Settings' defaults for new scenes, so the two cannot disagree about what a control writes. Pure.
 */
import type { SummarySettingsPatch } from "../../stage/contracts/chat-store";
import type { BackfillMode } from "./prompts";
import { SUMMARY_DEFAULTS, contextWindow, type ResolvedSummary } from "./settings";

/** The one method the select shows: Every exchange, else the rolling mode (RoleCall `summaryMethodOption`). */
export const optionOf = (r: ResolvedSummary): BackfillMode => (r.method === "pair" ? "pair" : r.mode);

/** The automation switch: on from interval 0 gives it a cadence (Every exchange needs none). */
export function autoPatch(r: ResolvedSummary, on: boolean): SummarySettingsPatch {
  return on && r.method !== "pair" && r.interval <= 0 ? { auto: true, interval: SUMMARY_DEFAULTS.enabledInterval } : { auto: on };
}

/** "Summarize every": nothing or zero turns automation off, a number turns it on. */
export function intervalPatch(value: number): SummarySettingsPatch {
  return Number.isNaN(value) || value <= 0 ? { interval: 0, auto: false } : { interval: value, auto: true };
}

/** The method select: Every exchange, or a rolling mode (which also gives a switched-on summary without an interval its 60). */
export function methodPatch(r: ResolvedSummary, option: BackfillMode): SummarySettingsPatch {
  if (option === "pair") return { method: "pair" };
  return { ...(r.auto && r.interval <= 0 ? { interval: SUMMARY_DEFAULTS.enabledInterval } : {}), method: "rolling", mode: option };
}

/** Hide messages already covered: turning it on with no Keep recent chosen takes the window it would use, else 60. */
export function hidePatch(r: ResolvedSummary): SummarySettingsPatch {
  if (r.hideOld) return { hideOld: false };
  return r.keepRecent === undefined ? { hideOld: true, keepRecent: contextWindow(r) ?? SUMMARY_DEFAULTS.keepRecent } : { hideOld: true };
}
