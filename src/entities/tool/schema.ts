/**
 * Canonical tool piece: one tool a model may call while it writes. It is data, never code: a name and a description the model
 * reads, the fields it fills in, and one first-party action that runs when it calls (core/tools.ts), which may roll a dice piece (entities/dice). A scene links the tools it
 * offers (ChatPrompting.tools); the same piece can be linked anywhere.
 */
import type { CanonicalEntity } from "../../core/canonical";

export type ToolFieldType = "text" | "number" | "boolean" | "choice";

export interface ToolField {
  /** The argument name the model fills in: a lowercase letter, then lowercase letters, digits and _. */
  name: string;
  description: string;
  type: ToolFieldType;
  /** The allowed values of a choice field; only a choice field has them. */
  choices?: string[];
  required: boolean;
}

/** What happens when the model calls the tool: roll the dice it writes in a text field, roll a library dice piece, run a library formula, or only record the call. */
export type ToolAction = { kind: "roll"; field: string } | { kind: "dice"; id: string } | { kind: "formula"; id: string } | { kind: "record" };

export interface ToolBody {
  name: string;
  /** What the model is told the tool is for and when to call it. */
  description: string;
  fields: ToolField[];
  action: ToolAction;
}

export type CanonicalTool = CanonicalEntity<"tool", ToolBody>;

export const emptyToolBody = (name: string): ToolBody => ({ name, description: "", fields: [], action: { kind: "record" } });
