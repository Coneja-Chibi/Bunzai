/**
 * Corruption, RoleCall's `corruption` tracker (Legacy Trackers, builtin-catalog.ts LEGACY_TRACKER_MODULES): degradation metrics, influence, and progressive
 * state changes. Registered through props/trackers/legacy.ts; the state is ChatStore rule 43's `corruption`, the rules are core/trackers/corruption.ts.
 */
import { trackerProp } from "../tracker-prop";
import { CorruptionPanel } from "./corruption-panel";

export const corruptionProp = trackerProp({
  module: "corruption",
  name: "Corruption",
  blurb: "Degradation metrics, influence, and progressive state changes.",
  icon: "lucide:skull",
  tone: "var(--stage-macro)",
  group: "legacy",
  reach: "model",
  title: "Corruption",
  noun: "Corruption",
  Panel: CorruptionPanel,
});
