/**
 * What the Messenger's Trackers panel decides before it draws (approved wireframe messenger-discord/panels.html section 5). A tracker is a registered Prop whose id carries the tracker prefix
 * (`tracker-<module>`, the id the prompt assembler reads); the panel lists those that are switched on in the scene and can be opened, which is either their own panel (the 12 legacy trackers) or
 * the Compendium's Storyboards through the Prop's gear (the 4 storyboards). Pure, so each rule is provable without a render.
 */
import { TRACKER_PROP_PREFIX, type TrackerModule } from "../../../../../../stage/contracts/chat-store";
import type { SceneProp } from "../../../props/prop-contract";

export const isTrackerProp = (p: Pick<SceneProp, "id">): boolean => p.id.startsWith(TRACKER_PROP_PREFIX);
export const moduleOf = (p: Pick<SceneProp, "id">): TrackerModule => p.id.slice(TRACKER_PROP_PREFIX.length) as TrackerModule;

/** A tracker the panel can open: it has a panel to show or a gear that opens its place. */
export const isOpenable = (p: SceneProp): boolean => isTrackerProp(p) && (p.panel !== undefined || p.gear !== undefined);

/** The ids of the trackers switched on in the scene, in the registry's order. */
export function trackersOn(props: readonly SceneProp[], on: readonly string[] | null): string[] {
  return props.filter((p) => isOpenable(p) && on?.includes(p.id)).map((p) => p.id);
}

/** The header line: how many are on, and how often the Story Director updates them when it does. */
export function trackersSummary(count: number, director: { on: boolean; autoUpdate: boolean; every: number } | null): string {
  const base = `${count} on`;
  if (!director || !director.on || !director.autoUpdate) return base;
  return `${base} · Story Director updates every ${director.every === 1 ? "reply" : `${director.every} replies`}`;
}
