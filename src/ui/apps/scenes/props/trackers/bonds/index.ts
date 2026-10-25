/**
 * Bonds, RoleCall's `bonds` tracker (Legacy Trackers, builtin-catalog.ts LEGACY_TRACKER_MODULES): blood, soul, pack, patron, and other supernatural bonds.
 * Registered through props/trackers/legacy.ts; the state is ChatStore rule 43's `bonds`, the rules are core/trackers/bonds.ts.
 */
import { trackerProp } from "../tracker-prop";
import { BondsPanel } from "./bonds-panel";

export const bondsProp = trackerProp({
  module: "bonds",
  name: "Bonds",
  blurb: "Blood, soul, pack, patron, and other supernatural bonds.",
  icon: "lucide:link",
  tone: "var(--stage-danger-text)",
  group: "legacy",
  reach: "model",
  title: "Supernatural Bonds",
  noun: "Bonds",
  Panel: BondsPanel,
});
