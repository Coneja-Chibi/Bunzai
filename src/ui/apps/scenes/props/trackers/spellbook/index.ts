/**
 * Spellbook, RoleCall's `spellbook` tracker (Legacy Trackers, builtin-catalog.ts LEGACY_TRACKER_MODULES): spells, cooldowns, costs, and tactical spell templates.
 * Registered through props/trackers/legacy.ts; the state is ChatStore rule 43's `spellbook`, the rules are core/trackers/spellbook.ts.
 */
import { trackerProp } from "../tracker-prop";
import { SpellbookPanel } from "./spellbook-panel";
import { summaryLine } from "./summary";

export const spellbookProp = trackerProp({
  module: "spellbook",
  name: "Spellbook",
  blurb: "Spells, cooldowns, costs, and tactical spell templates.",
  icon: "lucide:wand-sparkles",
  tone: "var(--stage-var)",
  group: "legacy",
  reach: "model",
  title: "Spellbook",
  noun: "Spellbook",
  Panel: SpellbookPanel,
  summary: summaryLine,
});
