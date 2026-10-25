/**
 * The cross-reference graph (RoleCall `lib/compendium/computed.ts` `SCAN_RULES`, `computeCrossReferenceGraph`,
 * `computeEntryLinks`): which typed field of which entry type names another entry. It feeds the Dashboard's graph cell, a
 * character's CROSS-REFS tile and an entry page's Linked Entries. Targets resolve by exact lowercase name; a name that
 * resolves to nothing is a dangling edge, kept so the page can show it. Pure.
 */
import { isRecord, type Rec } from "../guards";
import type { CompendiumEntry } from "./read";
import type { EntryType } from "./types";

type Shape = "scalar" | "strings" | { items: string };
type Rule = readonly [field: string, edge: string, shape: Shape];

const RULES: Readonly<Record<EntryType, readonly Rule[]>> = {
  character: [
    ["relationships", "relationship", { items: "with" }], ["affiliations", "affiliation", { items: "org" }], ["current_state.location", "current_location", "scalar"],
    ["powers", "power", { items: "name" }], ["possessions", "possession", "strings"], ["family.parents", "parent", "strings"], ["family.siblings", "sibling", "strings"],
    ["family.children", "child", "strings"], ["family.spouse", "spouse", "scalar"], ["death_details.where", "death_location", "scalar"], ["death_details.by_whom", "killed_by", "scalar"],
  ],
  location: [
    ["parent_location", "parent_location", "scalar"], ["connected_to", "connected_to", "strings"], ["inhabitants.key_residents", "inhabitant", "strings"],
    ["inhabitants.factions_present", "faction_present", "strings"], ["notable_items", "houses_item", "strings"], ["controlling_faction", "controlled_by", "scalar"],
  ],
  item: [["current_owner", "owner", "scalar"], ["current_location", "current_location", "scalar"], ["linked_powers", "grants_power", "strings"], ["set_pieces", "set_piece", "strings"]],
  organization: [
    ["leader", "leader", "scalar"], ["members", "member", { items: "name" }], ["allies", "ally", "strings"], ["enemies", "enemy", "strings"], ["territory", "territory", "strings"],
    ["headquarters", "headquarters", "scalar"], ["subsidiaries", "subsidiary", "strings"],
  ],
  event: [
    ["where", "where", "scalar"], ["participants", "participant", { items: "name" }], ["related_plots", "related_plot", "strings"], ["witnesses", "witness", "strings"],
    ["items_involved", "item_involved", "strings"],
  ],
  plot: [["central_characters", "central_character", "strings"], ["key_locations", "key_location", "strings"], ["involved_organizations", "involved_organization", "strings"], ["parent_plot", "parent_plot", "scalar"]],
  threat: [["source.reference", "source", "scalar"], ["affected_targets", "affected_target", "strings"], ["who_can_stop_it", "stopper", "strings"]],
  worldbuilding: [["applies_to", "applies_to", "strings"], ["related_to", "related_to", "strings"], ["embodied_by", "embodied_by", "strings"]],
  summary: [["parent_plot", "parent_plot", "scalar"], ["participants", "participant", "strings"], ["involved_locations", "involved_location", "strings"], ["pov_character", "pov_character", "scalar"]],
  creature: [["bonded_to", "bonded_to", "scalar"], ["linked_power", "summon_power", "scalar"], ["known_locations", "known_at", "strings"]],
  power: [["users", "wielder", "strings"], ["parent_power", "parent_power", "scalar"], ["variants", "variant_power", "strings"], ["related_powers", "related_power", "strings"]],
};

export interface CrossRefNode { id: string; name: string; type: EntryType; refs: number }
export interface CrossRefEdge { fromId: string; from: string; to: string; toId?: string; edge: string; field: string }
export interface CrossRefGraph { nodes: CrossRefNode[]; edges: CrossRefEdge[] }

const pluck = (data: Rec, path: string): unknown => path.split(".").reduce<unknown>((cur, key) => (isRecord(cur) ? cur[key] : undefined), data);
const text = (v: unknown): string[] => (typeof v === "string" && v.trim() ? [v] : []);

/** The names one rule finds in an entry's data. */
function targets(data: Rec, [field, , shape]: Rule): string[] {
  const value = pluck(data, field);
  if (shape === "scalar") return text(value);
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => (shape === "strings" ? text(v) : isRecord(v) ? text(v[shape.items]) : []));
}

/** Live (not retired) typed entries only; a disabled one still counts, as in RoleCall. */
export function buildCrossRefs(entries: readonly CompendiumEntry[]): CrossRefGraph {
  const typed = entries.filter((e) => e.type !== null && !e.retired);
  const byName = new Map<string, CompendiumEntry>();
  for (const e of typed) byName.set(e.name.toLowerCase(), e);
  const nodes = new Map<string, CrossRefNode>(typed.map((e) => [e.id, { id: e.id, name: e.name, type: e.type!, refs: 0 }]));
  const edges: CrossRefEdge[] = [];
  for (const from of typed) {
    for (const rule of RULES[from.type!]) {
      for (const to of targets(from.data, rule)) {
        const hit = byName.get(to.toLowerCase());
        if (hit) nodes.get(hit.id)!.refs += 1;
        edges.push({ fromId: from.id, from: from.name, to, ...(hit ? { toId: hit.id } : {}), edge: rule[1], field: rule[0] });
      }
    }
  }
  return { nodes: [...nodes.values()], edges };
}

/** An entry's links: what it names that resolves, and what names it (`computeEntryLinks`). A self-reference is not a link. */
export function linksOf(graph: CrossRefGraph, entryId: string): { outgoing: CrossRefEdge[]; incoming: CrossRefEdge[] } {
  return {
    outgoing: graph.edges.filter((e) => e.fromId === entryId && e.toId !== undefined && e.toId !== entryId),
    incoming: graph.edges.filter((e) => e.toId === entryId && e.fromId !== entryId),
  };
}
