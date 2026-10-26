/**
 * Creature Codex, RoleCall's `creatureCodex` tracker (Legacy Trackers, builtin-catalog.ts LEGACY_TRACKER_MODULES): bestiary entries, creature stats, ecology, and
 * weaknesses. Registered through props/trackers/legacy.ts; the state is ChatStore rule 43's `codex`, the rules are core/trackers/codex.ts.
 */
import { trackerProp } from "../tracker-prop";
import { CodexPanel } from "./codex-panel";
import { summaryLine } from "./summary";

export const codexProp = trackerProp({
  module: "codex",
  name: "Creature Codex",
  blurb: "Bestiary entries, creature stats, ecology, and weaknesses.",
  icon: "lucide:paw-print",
  tone: "color-mix(in srgb,var(--stage-link) 50%,var(--stage-ok))",
  group: "legacy",
  reach: "model",
  title: "Creature Codex",
  noun: "Creature Codex",
  Panel: CodexPanel,
  summary: summaryLine,
});
