/**
 * Cycles, RoleCall's `biologicalCycles` tracker (Legacy Trackers, builtin-catalog.ts LEGACY_TRACKER_MODULES): phase-based biological or supernatural cycles.
 * Registered through props/trackers/legacy.ts; the state is ChatStore rule 43's `cycles`, the rules are core/trackers/cycles.ts.
 */
import { trackerProp } from "../tracker-prop";
import { CyclesPanel } from "./cycles-panel";

export const cyclesProp = trackerProp({
  module: "cycles",
  name: "Cycles",
  blurb: "Phase-based biological or supernatural cycles.",
  icon: "lucide:moon",
  tone: "color-mix(in srgb,var(--stage-macro) 60%,var(--stage-danger-text))",
  group: "legacy",
  reach: "model",
  title: "Biological Cycles",
  noun: "Cycles",
  Panel: CyclesPanel,
});
