/**
 * Lite state-graph model: named states + transitions that compile to trigger rows.
 * Non-coders think in states; the wire still gets When/If/Then scripts.
 */
import { newUiId } from "../../../../_shared/new-id";
import { uniqueId } from "../../../../../core/list-ops";
import { asciiSlug } from "../../../../../core/text";

export const STATE_VAR = "state";

export interface GraphState {
  id: string;
  label: string;
}

export interface GraphTransition {
  id: string;
  /** state id leaving */
  from: string;
  /** state id entering */
  to: string;
  event: string;
  /** extra var conditions (not including the from-state check) */
  whenVar?: string;
  whenOp?: string;
  whenValue?: string;
  /** optional setvar side effect besides changing state */
  effectVar?: string;
  effectOp?: string;
  effectValue?: string;
}

export interface StateGraph {
  states: GraphState[];
  transitions: GraphTransition[];
}

export const blankGraph = (): StateGraph => ({
  states: [
    { id: "idle", label: "Idle" },
    { id: "busy", label: "Busy" },
  ],
  transitions: [],
});

export const newStateId = (label: string, used: ReadonlySet<string>): string => {
  const base = asciiSlug(label, { sep: "_", fallback: "state" });
  return uniqueId(used, base, (id, n) => `${id}_${n}`);
};

/**
 * Collision-resistant transition identity for editor-created moves. Pure seam so pane/UI never
 * invents timestamp-only ids; normalize/import paths keep existing ids untouched.
 */
export const newTransitionId = (): string => newUiId("t");
