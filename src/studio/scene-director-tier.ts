/**
 * The Director's actions on the scene tier table (scene-tiers.ts): planning, a person's edits and the automatic tracker update all write the Director's own state and nothing else, so both are held to the `write` tier.
 * The table is read when the action runs; an entry that says anything else (a read-only claim the action would break, or egress or more it was never cleared for) refuses the action with
 * that said, rather than running at a tier the table does not grant. `tiers` is the table, injectable so a test can change it.
 */
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";

export type DirectorAction = "director.plan" | "director.edit" | "director.trackers";
export type DirectorTiers = Readonly<Record<DirectorAction, string>>;

/** The sentence that says why the action may not run, or null when the table grants it. */
export function tierRefusal(action: DirectorAction, tiers: DirectorTiers = SCENE_ACTION_TIERS): string | null {
  const tier = tiers[action];
  return tier === "write" ? null : `${action} is set to the ${String(tier)} tier, and the Story Director needs write to keep its own story`;
}
