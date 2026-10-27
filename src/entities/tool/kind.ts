/** The tool kind: one tool a model may call while it writes, as data (core/tools.ts runs its action). */
import { defineKind } from "../_shared/kind-descriptor";
import { emptyToolBody, type ToolBody } from "./schema";

export default defineKind<"tool", ToolBody>({
  id: "tool", order: 75, singular: "Tool", plural: "Tools", short: "tool", receiptWord: "tool",
  blurb: "Things the model can do", icon: "lucide:wrench", accent: "var(--deck-regex)", libraryDeck: true,
  blank: () => emptyToolBody("My tool"), blankId: "tool",
  describe: (b) => [
    `name     ${b.name || "(unnamed)"}`,
    `fields   ${b.fields.map((f) => f.name).join(", ") || "(none)"}`,
    `action   ${b.action.kind}${"field" in b.action ? ` from ${b.action.field}` : "id" in b.action ? ` ${b.action.id}` : ""}`,
  ],
});
