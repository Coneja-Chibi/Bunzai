/**
 * The Storyboards dossiers as one table (RoleCall `dossiers/prompt-context.ts` buildPayload): a type to its builder, and the narrator's block, which is
 * RoleCall's "[COMPENDIUM STORYBOARDS CONTEXT]" with one "--- <book> / <dossier> / <profile> ---" section per book and dossier that has something to say.
 */
import type { CompendiumEntry } from "../read";
import { DOSSIER_TYPES, profileLabel, type ContextProfile, type DossierType } from "./base";
import { buildCast, type CastDossier } from "./cast";
import { buildMap, buildRenown, type MapDossier, type RenownDossier } from "./map-renown";
import { buildQuests, type QuestsDossier } from "./quests";

export * from "./base";
export type { CastDossier, MapDossier, QuestsDossier, RenownDossier };
export type { CastMember } from "./cast";
export type { QuestItem } from "./quests";
export type Dossier = QuestsDossier | CastDossier | MapDossier | RenownDossier;

export function buildDossier(type: DossierType, entries: readonly CompendiumEntry[], profile: ContextProfile): Dossier {
  switch (type) {
    case "quests": return buildQuests(entries, profile);
    case "cast": return buildCast(entries, profile);
    case "map": return buildMap(entries, profile);
    case "renown": return buildRenown(entries, profile);
  }
}

export const isDossierType = (id: string): id is DossierType => (DOSSIER_TYPES as readonly string[]).includes(id);

export interface StoryboardSource { name: string; entries: readonly CompendiumEntry[] }
export interface StoryboardRequest { type: DossierType; profile: ContextProfile }

/** RoleCall's header (prompt-context.ts:STORYBOARDS_HEADER) with the sentence about tool calls turned into what the narrator can use. */
export const STORYBOARDS_HEADER = [
  "[COMPENDIUM STORYBOARDS CONTEXT]",
  "Live compendium/storyboard context selected by the Storyboards settings. Slugs in {braces} are stable handles for the things named.",
];

/** The block for the books and dossiers asked for, or "" when none has a line to send (an empty dossier adds nothing, as in RoleCall). */
export function storyboardsText(books: readonly StoryboardSource[], asked: readonly StoryboardRequest[]): string {
  const parts: string[] = [];
  for (const { type, profile } of asked) {
    for (const book of books) {
      const d = buildDossier(type, book.entries, profile);
      // A dossier with nothing in it is only its heading and its [USE] lines: nothing to send.
      if (!hasSubstance(d)) continue;
      parts.push("", `--- ${book.name} / ${d.title} / ${profileLabel(profile.mode)} ---\n${d.ai.text.trim()}`);
    }
  }
  return parts.length === 0 ? "" : [...STORYBOARDS_HEADER, ...parts].join("\n");
}

function hasSubstance(d: Dossier): boolean {
  switch (d.type) {
    case "quests": return d.critical.length + d.active.length + d.blocked.length + d.failed.length > 0;
    case "cast": return d.cast.length > 0;
    case "map": return d.locations.length > 0;
    case "renown": return d.standings.length > 0;
  }
}
