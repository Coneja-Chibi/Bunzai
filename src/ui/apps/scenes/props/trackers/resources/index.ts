/**
 * Stats, RoleCall's `resources` tracker (Legacy Trackers, builtin-catalog.ts LEGACY_TRACKER_MODULES): HP, MP, AP, currency and other numerical
 * resources. Registered in props/registry.ts; the state is ChatStore rule 43's `resources`, the rules are core/trackers/resources.ts.
 */
import { trackerProp } from "../tracker-prop";
import { StatsPanel } from "./resources-panel";
import { summaryLine } from "./summary";

export const statsProp = trackerProp({
  module: "resources",
  name: "Stats",
  blurb: "HP, MP, AP, currency, and other numerical resources.",
  icon: "lucide:heart",
  tone: "var(--stage-ok)",
  group: "legacy",
  reach: "model",
  title: "Player Stats",
  noun: "Stats",
  Panel: StatsPanel,
  summary: summaryLine,
});
