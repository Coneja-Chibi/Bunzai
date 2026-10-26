/**
 * Events, RoleCall's `parallelEvents` tracker (Legacy Trackers, builtin-catalog.ts LEGACY_TRACKER_MODULES): simultaneous events happening away from the current
 * scene. Registered through props/trackers/legacy.ts; the state is ChatStore rule 43's `events`, the rules are core/trackers/events.ts.
 */
import { trackerProp } from "../tracker-prop";
import { EventsPanel } from "./events-panel";
import { summaryLine } from "./summary";

export const eventsProp = trackerProp({
  module: "events",
  name: "Events",
  blurb: "Simultaneous events happening away from the current scene.",
  icon: "lucide:layers",
  tone: "var(--stage-var)",
  group: "legacy",
  reach: "model",
  title: "Parallel Events",
  noun: "Events",
  Panel: EventsPanel,
  summary: summaryLine,
});
