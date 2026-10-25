/**
 * The Compendium's eleven entry types and how each is labelled and coloured.
 * Order is RoleCall's tree bucket order (`lib/lorebook/tv-tree-typed.ts:48-60`). Colours are theme token
 * names, never hex: RoleCall's `entryTypeToColor` (`lib/compendium/computed.ts:206`) returns hex, which
 * the colour guard forbids here, so the UI wraps a token in `var(...)`.
 */
import { isOneOf } from "../guards";

export const ENTRY_TYPES = ["character", "location", "item", "power", "organization", "event", "plot", "threat", "worldbuilding", "summary", "creature"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export interface EntryTypeInfo {
  /** The chip and breadcrumb word: "Character". */
  label: string;
  /** The tree bucket (`tv-tree-typed.ts:64-76`): "Cast". */
  bucket: string;
  /** The By Type section header (RoleCall `ByTypeView.tsx:32-44`): "Cast", "Orgs", "World", "Recaps". */
  section: string;
  /** A theme token from src/ui/theme/tokens.css. */
  token: string;
}

export const ENTRY_TYPE_INFO: Readonly<Record<EntryType, EntryTypeInfo>> = {
  character: { label: "Character", bucket: "Cast", section: "Cast", token: "--deck-character" },
  location: { label: "Location", bucket: "Places", section: "Places", token: "--deck-persona" },
  item: { label: "Item", bucket: "Items", section: "Items", token: "--deck-preset" },
  power: { label: "Power", bucket: "Powers", section: "Powers", token: "--deck-lorebook" },
  organization: { label: "Organization", bucket: "Organizations", section: "Orgs", token: "--deck-pack" },
  event: { label: "Event", bucket: "Events", section: "Events", token: "--deck-regex" },
  plot: { label: "Plot", bucket: "Plots", section: "Plots", token: "--bk-role-select" },
  threat: { label: "Threat", bucket: "Threats", section: "Threats", token: "--bk-role-danger" },
  worldbuilding: { label: "Worldbuilding", bucket: "Worldbuilding", section: "World", token: "--bk-role-info" },
  summary: { label: "Summary", bucket: "Narrative", section: "Recaps", token: "--deck-fog" },
  creature: { label: "Creature", bucket: "Bestiary", section: "Creatures", token: "--bk-role-warn" },
};

export const isEntryType = (value: unknown): value is EntryType => isOneOf(value, ENTRY_TYPES);
