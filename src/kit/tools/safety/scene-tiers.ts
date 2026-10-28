/**
 * scene-tiers: the one table that puts a scene's actions and a Compendium book's access levels on Kit's risk tiers
 * (risk.ts), so the scene has no permission vocabulary of its own. A book's level is the highest tier the Compendium may use on it;
 * the extra word is whether it may also read. `canRead` and `canWrite` (core/compendium/defaults.ts) are what the passes call;
 * scene-tiers.test.ts holds them to this table. Every action here is first-party and runs only on the person's own click or
 * the scene's own turn (the Story Director's plan and a person's edits of its story write only the Director's own state); none is a tool a model may call, except narrator lookup and the library tools a scene links (their actions roll or record), which the tool loop holds to `read`, and the trackers' update tool, the one write the loop runs (its effect is reply-scoped scene state).
 */
import type { CompendiumAccess } from "../../../stage/contracts/chat-settings-types";
import type { ToolAccess } from "./risk";

/** The tier a book's access level allows (null: none) and whether it allows reading the book. */
export const COMPENDIUM_ACCESS_TIERS: Readonly<Record<CompendiumAccess, { tier: ToolAccess | null; reads: boolean }>> = {
  off: { tier: null, reads: false },
  read_only: { tier: "read", reads: true },
  read_write: { tier: "write", reads: true },
  write_only: { tier: "write", reads: false },
};

/** Each scene action and the tier it works at. */
export const SCENE_ACTION_TIERS = {
  "compendium.filing": "write",
  "compendium.historian": "write",
  "compendium.tree": "write",
  "compendium.standardize": "write",
  "compendium.ingest": "write",
  "compendium.reconcile": "write",
  "finalcut.rewrite": "write",
  "director.plan": "write",
  "director.edit": "write",
  "director.trackers": "write",
  "tracker.generate": "draft",
  "tracker.refresh": "draft",
  "tracker.forecast": "draft",
  "narrator.lookup": "read",
  "narrator.tool": "read",
  // The one tool a model calls that writes (update_trackers): its only effect is scene-state deltas pending on the reply being written, which a regenerate, swipe or cut takes back, so the loop runs it as write + stateScoped (stage/provider/tool-loop.ts).
  "narrator.tracker": "write",
  "spotify.control": "egress",
} as const satisfies Record<string, ToolAccess>;

export type SceneAction = keyof typeof SCENE_ACTION_TIERS;
