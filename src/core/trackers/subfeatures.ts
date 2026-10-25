/**
 * The sub-features of the legacy trackers (RoleCall `lib/stagecraft/module-subfeatures.ts` MODULE_SUB_FEATURES): switches under a module's tile that narrow
 * what it keeps and what the model is asked to write (Knowledge's Secrets, the Creature Codex's six). They ride in the module's own state (`subs`, ChatStore
 * rule 43), so switching a module off keeps them. Pure. The `icon` is an id from ui/_shared/ic.tsx (RoleCall's own, e.g. `lucide:lock`), kept as text here because core knows no UI.
 */
import type { TrackerModule } from "../../stage/contracts/chat-tracker-types";

export interface SubFeature { id: string; label: string; description: string; icon: string }

export const SUBFEATURES: Readonly<Partial<Record<TrackerModule, readonly SubFeature[]>>> = {
  knowledge: [
    { id: "secrets", label: "Secrets", description: "Bidirectional secret tracking with concealment", icon: "lucide:lock" },
  ],
  codex: [
    { id: "creatureStats", label: "Creature Stats", description: "HP, MP, attack, defense, speed: full RPG stat blocks and mechanical ability numbers", icon: "lucide:bar-chart-3" },
    { id: "combat", label: "Combat Profiles", description: "Threat levels, abilities, weaknesses, and loot drops", icon: "lucide:swords" },
    { id: "ecology", label: "Ecology", description: "Ecosystem roles, migration patterns, population status", icon: "lucide:leaf" },
    { id: "taming", label: "Taming & Bonds", description: "Taming methods, loyalty mechanics, mount potential", icon: "lucide:heart-handshake" },
    { id: "arcana", label: "Arcana & Magic", description: "Magic affinities, reagents, ritual uses, cursed variants", icon: "lucide:sparkles" },
    { id: "research", label: "Research Notes", description: "Knowledge levels, field notes, specimen tracking", icon: "lucide:microscope" },
  ],
  cycles: [
    { id: "lunarCycles", label: "Lunar Cycles", description: "Werewolf and lycanthropic transformations linked to calendar moon phases", icon: "lucide:orbit" },
    { id: "fertilityTracking", label: "Fertility Tracking", description: "Fertility windows, ovulation tracking, and conception probability", icon: "lucide:heart-pulse" },
    { id: "hormoneEffects", label: "Hormone Effects", description: "Mood modifiers and stat effects driven by cycle phases", icon: "lucide:brain" },
    { id: "pregnancyTracking", label: "Pregnancy Tracking", description: "Week-by-week baby development, trimester progress, due dates, and menstrual cycle phases", icon: "lucide:baby" },
  ],
  spellbook: [
    { id: "tacticalMode", label: "Tactical Mode", description: "D&D-style dice rolls, strict mana costs, and mechanical enforcement", icon: "lucide:swords" },
    { id: "wildMagic", label: "Wild Magic", description: "Chance of random magical side effects when casting", icon: "lucide:sparkles" },
  ],
};

export const subIds = (module: TrackerModule): readonly string[] => (SUBFEATURES[module] ?? []).map((s) => s.id);

/** Whether a module's `subs` names only sub-features it has. */
export const subsKnown = (module: TrackerModule, subs: Readonly<Record<string, boolean>>): boolean => Object.keys(subs).every((k) => subIds(module).includes(k));
