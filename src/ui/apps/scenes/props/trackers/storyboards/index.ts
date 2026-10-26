/**
 * The Storyboard Props: Quest Board, Cast, Map and Renown (RoleCall builtin-catalog.ts STORYBOARD_MODULES, card text word for word). Each is a tile in the
 * Storyboards box; switching it on adds its dossier to the Compendium's Storyboards tab and, unless its AI Context is Off, its digest to the prompt
 * (core/assembly/storyboards.ts). They keep only that AI Context choice (ChatStore rule 43); the data is the book's entries. Calendar is RoleCall's fifth and
 * is not built: its state exists only in the Story Director's journal. Its tile stands in the box dimmed and says so.
 */
import type { DossierType } from "../../../../../../core/compendium/dossiers";
import { TRACKER_PROP_PREFIX } from "../../../../../../stage/contracts/chat-store";
import type { IconName } from "../../../../../_shared/ic";
import { openStoryboards } from "../../../compendium/storyboards/storyboards-open";
import type { SceneProp } from "../../prop-contract";
import { registerSummary } from "../summary";
import { summaryLine } from "./summary";

export interface StoryboardDef { type: DossierType; name: string; blurb: string; icon: IconName; tone: string }

export const STORYBOARDS: readonly StoryboardDef[] = [
  { type: "quests", name: "Quest Board", blurb: "Goals, blockers, deadlines, rewards, and consequence pressure.", icon: "lucide:clipboard-list", tone: "var(--stage-ok)" },
  { type: "cast", name: "Cast", blurb: "Character files, relationships, memories, hidden knowledge, and drift.", icon: "lucide:users-round", tone: "var(--deck-character)" },
  { type: "map", name: "Map", blurb: "Locations, regions, travel state, discoveries, hazards, and movement history.", icon: "lucide:map", tone: "var(--stage-link)" },
  { type: "renown", name: "Renown", blurb: "Public standing, heat, favors banked and owed, oaths, blackmail, and influence.", icon: "lucide:landmark", tone: "var(--stage-macro)" },
];

/** RoleCall's fifth Storyboard, drawn inert with the reason (RoleCall's `unavailableReason` pattern, StagecraftExtensions.tsx:2128). */
export const CALENDAR_SOON = { name: "Calendar", blurb: "Story date, timelines, deadlines, prophecies, moons, and temporal pressure.", why: "Needs the Story Director, which keeps the story date. Not in this release." } as const;

const BULLETS = [
  "First-class story state, drawn from the Compendium's typed entries.",
  "Adds a dossier to the Compendium's Storyboards tab and can be included in AI context.",
  "Saves per chat; switching it off keeps its settings.",
] as const;

/** Quest Board and Cast start on, Map and Renown off (RoleCall defaults), which the card line reads while no choice is stored. */
const DEFAULT_ON: readonly DossierType[] = ["quests", "cast"];

export const storyboardProps: SceneProp[] = STORYBOARDS.map((def): SceneProp => {
  registerSummary(def.type, summaryLine(DEFAULT_ON.includes(def.type)));
  return {
    id: `${TRACKER_PROP_PREFIX}${def.type}`,
    name: def.name,
    blurb: def.blurb,
    tier: "Storyboard",
    reach: "none",
    icon: def.icon,
    tone: def.tone,
    group: "storyboard",
    tip: { description: def.blurb, bullets: BULLETS },
    gear: () => openStoryboards(def.type),
  };
});
