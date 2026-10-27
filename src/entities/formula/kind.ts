/** The formula kind: a saved macro expression (core/formula.ts runs it). */
import { defineKind } from "../_shared/kind-descriptor";
import { emptyFormulaBody, type FormulaBody } from "./schema";

export default defineKind<"formula", FormulaBody>({
  id: "formula", order: 77, singular: "Formula", plural: "Formulas", short: "fx", receiptWord: "formula",
  blurb: "Saved macro math", icon: "lucide:variable", accent: "var(--deck-lorebook)", libraryDeck: true,
  blank: () => emptyFormulaBody("My formula"), blankId: "formula",
  describe: (b) => [
    `name     ${b.name || "(unnamed)"}`,
    `text     ${b.text.replace(/\s+/g, " ").slice(0, 80) || "(empty)"}`,
  ],
});
