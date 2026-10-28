/**
 * Where the Messenger's own presentations of a Prop's panel are attached to the programs (messenger/programs.ts). A program's `panel` is a pop-out kind; the page draws it through
 * PopoutSlot, so giving the program a kind with the SAME id and a different `render` changes how it looks in the Messenger and nothing else: the floating copy, its saved place and
 * its "is floating" placeholder still belong to the original kind. Kinds are held so a program list that did not change keeps the same kind (programs.ts `useStablePrograms`).
 * The Trackers program is new here: the tracker Props that are on, and the library trackers the scene links, collapse into one program whose panel lists them (trackers/trackers-panel.tsx).
 */
import type { IconName } from "../../../../_shared/ic";
import type { PopoutKind } from "../../popout/popout-kind";
import type { SceneProp } from "../../props/prop-contract";
import { MessengerDirectorPanel } from "./director/director-view";
import { MessengerTrackersPanel } from "./trackers/trackers-panel";
import { isTrackerProp, trackersOn } from "./trackers/trackers-core";

const OVERRIDES = new Map<string, PopoutKind>();

/** The Messenger's version of a Prop's panel kind, or the kind itself when the Messenger draws it as Full Chat does. */
export function messengerKind(kind: PopoutKind): PopoutKind {
  if (kind.id !== "director.panel") return kind;
  let held = OVERRIDES.get(kind.id);
  if (!held || held.title !== kind.title) {
    held = { ...kind, render: (c) => <MessengerDirectorPanel {...c} /> };
    OVERRIDES.set(kind.id, held);
  }
  return held;
}

const TRACKERS_ICON: IconName = "lucide:list";
let heldTrackers: { key: string; kind: PopoutKind } | null = null;

/** The one kind for the trackers that are on; the same object while the set is the same. */
function trackersKind(ids: readonly string[]): PopoutKind {
  const key = ids.join(",");
  if (heldTrackers?.key !== key) {
    heldTrackers = { key, kind: { id: "messenger.trackers", title: "Trackers", noun: "Trackers", icon: TRACKERS_ICON, render: (c) => <MessengerTrackersPanel {...c} ids={ids} /> } };
  }
  return heldTrackers.kind;
}

/** Props with a panel of their own program, minus the trackers, which share one. */
export const hasOwnProgram = (p: SceneProp): boolean => p.panel !== undefined && !isTrackerProp(p);

/** The Trackers program while any tracker is on, any library tracker is linked or the library holds one (so the first can be added), else none. */
export function trackersProgram(props: readonly SceneProp[], on: readonly string[] | null, linked: readonly string[] = [], libraryHasTrackers = false): { id: string; wing: string; title: string; icon: IconName; panel: PopoutKind }[] {
  const ids = trackersOn(props, on);
  return ids.length === 0 && linked.length === 0 && !libraryHasTrackers ? [] : [{ id: "trackers", wing: "props", title: "Trackers", icon: TRACKERS_ICON, panel: trackersKind(ids) }];
}
