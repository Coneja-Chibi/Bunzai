/**
 * Combat, RoleCall's `battle` tracker (Legacy Trackers, builtin-catalog.ts LEGACY_TRACKER_MODULES): turn order, enemies, damage and tactical pressure.
 * Registered in props/registry.ts; the state is ChatStore rule 43's `battle`, the rules are core/trackers/battle.ts.
 */
import { trackerProp } from "../tracker-prop";
import { CombatPanel } from "./battle-panel";

export const combatProp = trackerProp({
  module: "battle",
  name: "Combat",
  blurb: "Turn order, enemies, damage, and tactical pressure.",
  icon: "lucide:swords",
  tone: "var(--stage-danger-text)",
  group: "legacy",
  reach: "model",
  title: "Battle Tracker",
  noun: "Combat",
  Panel: CombatPanel,
});
