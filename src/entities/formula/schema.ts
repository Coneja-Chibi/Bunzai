/**
 * Canonical formula piece: a saved macro expression, such as counting a word in the chat plus a roll, made once and run anywhere.
 * It is macro text and nothing else; core/formula.ts runs it on a copy of the scene's macro context.
 */
import type { CanonicalEntity } from "../../core/canonical";

export interface FormulaBody {
  name: string;
  description: string;
  /** The macro expression, such as {{calc::{{mentions::storm::20}} + 1}}. */
  text: string;
}

export type CanonicalFormula = CanonicalEntity<"formula", FormulaBody>;

export const emptyFormulaBody = (name: string): FormulaBody => ({ name, description: "", text: "" });
