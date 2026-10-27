/** The drawing kind: sealed HTML pages shown in HTML View (not a Library deck). */
import { defineKind } from "../_shared/kind-descriptor";
import type { HtmlDocBody } from "./schema";

export default defineKind<"htmldoc", HtmlDocBody>({
  id: "htmldoc", order: 90, singular: "Drawing", plural: "Drawings", short: "draw", receiptWord: "drawing",
  blurb: "Pages you draw", icon: "lucide:app-window", accent: "var(--deck-fog)", libraryDeck: false,
  editor: { id: "htmldoc", label: "Drawing editor", load: "light" },
  describe: (b) => [
    `name     ${b.name || "(unnamed)"}`,
    `summary  ${b.summary || "(none)"}`,
    `size     ${b.html.length} characters`,
    `tags     ${b.tags?.join(", ") || "(none)"}`,
  ],
});
