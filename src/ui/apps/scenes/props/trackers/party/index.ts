/**
 * Party, RoleCall's `party` tracker (Legacy Trackers, builtin-catalog.ts LEGACY_TRACKER_MODULES): party members, formations, status, and roles. Registered
 * through props/trackers/legacy.ts; the state is ChatStore rule 43's `party`, the rules are core/trackers/party.ts.
 */
import { trackerProp } from "../tracker-prop";
import { PartyPanel } from "./party-panel";
import { summaryLine } from "./summary";

export const partyProp = trackerProp({
  module: "party",
  name: "Party",
  blurb: "Party members, formations, status, and roles.",
  icon: "lucide:shield",
  tone: "var(--stage-warn)",
  group: "legacy",
  reach: "model",
  title: "Party",
  noun: "Party",
  Panel: PartyPanel,
  summary: summaryLine,
});
