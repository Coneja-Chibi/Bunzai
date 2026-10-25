/**
 * The Legacy Trackers box in RoleCall's order (builtin-catalog.ts LEGACY_TRACKER_MODULES): Combat, Stats, Inventory, Knowledge, Party, Corruption, Bonds,
 * Events, Cycles, Spellbook, Memories, Creature Codex. One line per module here; props/registry.ts takes the list whole.
 */
import type { SceneProp } from "../prop-contract";
import { bondsProp } from "./bonds";
import { codexProp } from "./codex";
import { combatProp } from "./battle";
import { corruptionProp } from "./corruption";
import { cyclesProp } from "./cycles";
import { eventsProp } from "./events";
import { inventoryProp } from "./inventory";
import { knowledgeProp } from "./knowledge";
import { memoriesProp } from "./memories";
import { partyProp } from "./party";
import { spellbookProp } from "./spellbook";
import { statsProp } from "./resources";

export const legacyProps: readonly SceneProp[] = [combatProp, statsProp, inventoryProp, knowledgeProp, partyProp, corruptionProp, bondsProp, eventsProp, cyclesProp, spellbookProp, memoriesProp, codexProp];
