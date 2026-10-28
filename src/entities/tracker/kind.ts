/** The tracker kind: named typed fields kept as scene state, shown to the model and updated by it (core/tracker.ts runs it). */
import { defineKind } from "../_shared/kind-descriptor";
import { emptyTrackerBody, type TrackerBody } from "./schema";

export default defineKind<"tracker", TrackerBody>({
  id: "tracker", order: 78, singular: "Tracker", plural: "Trackers", short: "trk", receiptWord: "tracker",
  blurb: "State the story keeps", icon: "lucide:gauge", accent: "var(--deck-persona)", libraryDeck: true, promptingList: "trackers",
  blank: () => emptyTrackerBody("My tracker"), blankId: "tracker",
  editor: { id: "tracker", label: "Tracker editor", load: "light" },
  describe: (b) => [
    `name     ${b.name || "(unnamed)"}`,
    `layout   ${b.layout}`,
    `fields   ${b.fields.map((f) => f.name).join(", ") || "(none)"}`,
  ],
});
