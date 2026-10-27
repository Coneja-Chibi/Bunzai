/** The Script Sheet kind: one writing instruction, a writing setup like a preset and shown in the same deck. */
import { defineKind } from "../_shared/kind-descriptor";
import { emptyScriptSheetBody, type ScriptSheetBody } from "./schema";
import { scriptSheetProblem, sheetAsPreset } from "../../core/preset/script-sheet";

export default defineKind<"scriptsheet", ScriptSheetBody>({
  id: "scriptsheet", order: 55, singular: "Script Sheet", plural: "Script Sheets", short: "sht", receiptWord: "script sheet",
  blurb: "One writing instruction", icon: "lucide:book-open", accent: "var(--deck-preset)", libraryDeck: true, deck: "preset",
  sceneField: "preset",
  asPreset: sheetAsPreset,
  // RoleCall's readScriptSheet refusal: a stored sheet that breaks the rules stops the turn rather than sending something else
  sendProblem: (b) => (scriptSheetProblem(b.content) ? "This Script Sheet has invalid instructions. Choose another Script Sheet or Preset in Prompting." : null),
  blank: () => emptyScriptSheetBody("My Script Sheet"), blankId: "script-sheet",
  editor: { id: "scriptsheet", label: "Script Sheet editor", load: "light" },
  describe: (b) => [`name     ${b.name || "(unnamed)"}`, `content  ${b.content.length} chars`],
});
