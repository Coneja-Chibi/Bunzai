/** The regex set kind: find-and-replace rules a scene can switch on. */
import { defineKind } from "../_shared/kind-descriptor";
import { emptyRegexSetBody, type RegexSetBody } from "./schema";

export default defineKind<"regex", RegexSetBody>({
  id: "regex", order: 60, singular: "Regex set", plural: "Regex sets", short: "rgx", receiptWord: "regex set",
  blurb: "Text transformations", icon: "lucide:regex", accent: "var(--deck-regex)", libraryDeck: true,
  blank: () => emptyRegexSetBody("Untitled regex set"), blankId: "regex", sceneField: "regex",
  editor: { id: "regex", label: "Regex set editor", load: "light" },
  describe: (b) => [`name     ${b.name || "(unnamed)"}`, `rules    ${b.rules.length}`],
});
