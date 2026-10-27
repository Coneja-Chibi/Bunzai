/** The lorebook kind: world knowledge that enters a reply when its keys match. */
import { defineKind } from "../_shared/kind-descriptor";
import { emptyLorebookBody } from "../../core/lore/empty-book";
import type { LorebookBody } from "./schema";

export default defineKind<"lorebook", LorebookBody>({
  id: "lorebook", order: 20, singular: "Lorebook", plural: "Lorebooks", short: "lore", receiptWord: "lorebook",
  blurb: "World knowledge", icon: "lucide:book-open", accent: "var(--deck-lorebook)", libraryDeck: true,
  blank: () => emptyLorebookBody(), blankId: "lorebook", sceneField: "lore",
  editor: { id: "lorebook", label: "Lorebook editor", load: "lore" },
  describe: (b) => [
    `name     ${b.name || "(unnamed)"}`,
    `type     ${b.lorebookType ?? "(none)"}`,
    `entries  ${b.entries.length}`,
    `budget   ${b.tokenBudget} (${b.budgetMode})`,
  ],
});
