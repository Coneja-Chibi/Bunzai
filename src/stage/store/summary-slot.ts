/**
 * The take's summary on the `summary` slot (ChatStore rule 45), shared by both stores so they cannot read or write it differently. A read is the text the take's
 * rows make (core/summary/rows.ts); the person's whole-text write is one person row, written as an edit of the take's newest live message through the same door as every person edit,
 * so the guard is that door's. It carries a fresh edit id and never touches a generated row's path. Generated pieces do not come through here: they are written on the version they are about (`recordDeltas`).
 */
import { personDeltas, takeOf } from "../../core/summary/rows";
import type { SceneState } from "../../core/scene-state/types";
import type { ChatStore } from "../contracts/chat-store";
import { checkTakeSummary } from "./summary-rules";

export interface SummaryIo {
  sceneState(branchId: string): Promise<SceneState | null>;
  /** The id of the take's newest live message, or null. */
  tip(branchId: string): Promise<string | null>;
  recordMessageDeltas: ChatStore["recordMessageDeltas"];
  now(): number;
  /** A fresh id for each save of the person's text. */
  newId(): string;
}

export function summaryOnSlot(io: SummaryIo): Pick<ChatStore, "summaryOf" | "setSummary"> {
  return {
    async summaryOf(branchId) {
      return takeOf(await io.sceneState(branchId));
    },
    async setSummary(branchId, inputRaw, guard) {
      const input = checkTakeSummary(inputRaw);
      const state = await io.sceneState(branchId);
      const tip = state ? await io.tip(branchId) : null;
      if (!state || !tip) return null;
      const deltas = personDeltas(state, input, io.now(), io.newId());
      if (deltas.length > 0 && !(await io.recordMessageDeltas(branchId, tip, deltas, guard))) return null;
      return { summary: takeOf(await io.sceneState(branchId)) };
    },
  };
}
