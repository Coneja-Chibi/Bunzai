/**
 * The Map and Renown dossiers (RoleCall `lib/compendium/dossiers/{map,renown}.ts`), each a view of one entry type: Map lists the book's locations with
 * their region, danger and whether they were visited; Renown lists its organizations with public standing, heat and the favors banked and owed.
 * RoleCall adds the places and standings the Story Director's journal mentions and Map's "current location" from that journal; neither exists here, so
 * Map has no current location and a standing shows only what the entry carries. RoleCall's "use slugs in tool calls" lines are left out (no tools).
 */
import type { CompendiumEntry } from "../read";
import { aiContext, clamp, entriesOfType, lineLimit, readBool, readNumber, readString, slug, type ContextProfile, type DossierAiContext } from "./base";

export interface Place { id: string; slug: string; name: string; type: string; description: string | null; region: string | null; danger: string | null; visited: boolean }
export interface MapDossier {
  type: "map"; title: "Map";
  stats: { knownLocations: number; visitedLocations: number; dangerousLocations: number; regions: number };
  locations: Place[]; ai: DossierAiContext;
}

export function buildMap(entries: readonly CompendiumEntry[], profile: ContextProfile): MapDossier {
  const locations = entriesOfType(entries, "location").map((e): Place => {
    const sd = e.data;
    return {
      id: e.id, slug: slug(e.name), name: e.name, type: readString(sd, ["type", "location_type", "kind"]) ?? "location",
      description: readString(sd, ["description", "summary"]), region: readString(sd, ["region", "parent", "area"]),
      danger: readString(sd, ["dangerLevel", "danger_level", "danger"]), visited: readBool(sd, ["visited", "has_been_visited"]),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const lines = ["[MAP]"];
  const priority = [...locations].sort((a, b) => Number(b.visited) - Number(a.visited)).slice(0, lineLimit(profile, 8));
  if (priority.length > 0) {
    lines.push("[LOCATIONS]");
    for (const l of priority) {
      const details = [l.type, l.region ? `region ${l.region}` : null, l.danger ? `danger ${l.danger}` : null].filter(Boolean);
      lines.push(`- {${l.slug}} ${l.name}${details.length ? `: ${details.join("; ")}` : ""}${l.description ? `. ${l.description}` : "."}`);
    }
  }
  lines.push("[USE]", "- Keep travel, distance, danger, and current location consistent.");
  return {
    type: "map", title: "Map",
    stats: { knownLocations: locations.length, visitedLocations: locations.filter((l) => l.visited).length, dangerousLocations: locations.filter((l) => l.danger === "high" || l.danger === "extreme").length, regions: new Set(locations.flatMap((l) => (l.region ? [l.region] : []))).size },
    locations, ai: aiContext(lines, profile),
  };
}

export interface Standing {
  id: string; slug: string; name: string; entityType: string; region: string | null; reputation: number; heat: number; heatLabel: string | null; kind: string | null; banked: number; owed: number;
}
export interface RenownDossier {
  type: "renown"; title: "Renown";
  stats: { standings: number; hotStandings: number; wantedStandings: number; favorsBanked: number; favorsOwed: number; regions: number };
  standings: Standing[]; ai: DossierAiContext;
}

export function buildRenown(entries: readonly CompendiumEntry[], profile: ContextProfile): RenownDossier {
  const standings = entriesOfType(entries, "organization").map((e): Standing => {
    const sd = e.data;
    return {
      id: e.id, slug: slug(readString(sd, ["slug"]) ?? e.name), name: e.name, entityType: readString(sd, ["entityType", "entity_type", "type"]) ?? "organization", region: readString(sd, ["region", "area"]),
      reputation: clamp(readNumber(sd, ["reputation", "standing", "renown"]) ?? 0, -100, 100), heat: clamp(readNumber(sd, ["heatScore", "heat_score", "heat"]) ?? 0, 0, 100),
      heatLabel: readString(sd, ["heatLabel", "heat_label"]), kind: readString(sd, ["relationshipKind", "relationship_kind", "relation"]),
      banked: readNumber(sd, ["favorsBanked", "favors_banked"]) ?? 0, owed: readNumber(sd, ["favorsOwed", "favors_owed"]) ?? 0,
    };
  }).sort((a, b) => b.heat - a.heat || a.name.localeCompare(b.name));
  const lines = ["[RENOWN]"];
  const priority = [...standings].sort((a, b) => b.heat - a.heat || Math.abs(b.reputation) - Math.abs(a.reputation)).slice(0, lineLimit(profile, 8));
  for (const s of priority) {
    const mood = s.heat >= 70 ? "wanted" : s.reputation >= 30 ? "admired" : s.reputation <= -30 ? "distrusted" : "neutral";
    lines.push(`- {${s.slug}} ${s.name}: ${[mood, `rep ${s.reputation}`, `heat ${s.heat}`, s.region ? `region ${s.region}` : null, s.heatLabel].filter(Boolean).join("; ")}.`);
  }
  const open = standings.filter((s) => s.banked || s.owed);
  if (profile.mode !== "compact" && open.length > 0) {
    lines.push("[OBLIGATIONS]");
    for (const s of open.slice(0, lineLimit(profile, 5))) lines.push(`- {${s.slug}} banked ${s.banked}; owed ${s.owed}.`);
  }
  lines.push("[USE]", "- NPC reactions should reflect local standing and heat, not generic friendliness.", "- High heat should create scrutiny, blocked access, or ambush risk.", "- Favors and debts should resurface naturally without forcing the scene.");
  return {
    type: "renown", title: "Renown",
    stats: {
      standings: standings.length, hotStandings: standings.filter((s) => s.heat >= 30).length, wantedStandings: standings.filter((s) => s.heat >= 70).length,
      favorsBanked: standings.reduce((n, s) => n + s.banked, 0), favorsOwed: standings.reduce((n, s) => n + s.owed, 0), regions: new Set(standings.flatMap((s) => (s.region ? [s.region] : []))).size,
    },
    standings, ai: aiContext(lines, profile),
  };
}
