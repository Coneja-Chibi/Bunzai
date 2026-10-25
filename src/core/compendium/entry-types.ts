/**
 * What each entry type's `structured_data` may hold at its top level, and the kind of each field, taken once from RoleCall's
 * `Remember_*` tool schemas (`lib/ai/dm-stream/tools/compendium-definitions.ts:1945-2757`, the `reason` field left out because it is
 * not entry data). Reading is lenient and keeps everything: `parseStructured` never drops a field, it reports what a known field
 * holds wrongly (a type or enum mismatch) and which required fields are missing, so an imported or older RoleCall book still
 * reads. Rejecting is the filing path's job, not this module's. Nested shapes (the objects and the array items) are not checked here.
 *
 * Kinds: s string, n number, b boolean, a array, o object, so string or object, e(a|b) one of the listed strings.
 */
import { isRecord, type Rec } from "../guards";
import type { EntryType } from "./types";

const SPEC: Record<EntryType, string> = {
  character: "name:s description:s aliases:a role:e(protagonist|antagonist|ally|rival|neutral|background|deity|player_character) species:s age:s pronouns:s physical:o personality:o background:o current_state:o arc:o relationships:a memories:a tier:s notable_stats:so powers:a possessions:a affiliations:a voice:o skills:a languages:a family:o reputation:s likes:a dislikes:a strengths:a weaknesses:a minor_facts:a death_details:o",
  location: "name:s description:s type:e(city|town|village|settlement|building|room|dungeon|wilderness|region|realm|plane) parent_location:s physical:o inhabitants:o points_of_interest:a current_state:o connected_to:a atmosphere:o history:s climate:s dangers:a local_laws:a architecture:s notable_items:a controlling_faction:s minor_facts:a",
  item: "name:s description:s type:e(weapon|armor|tool|consumable|artifact|document|key|treasure|mundane|magical|relic) physical:o abilities:a drawbacks:a current_owner:s current_location:s provenance:s significance:s condition:e(pristine|good|damaged|broken|destroyed|lost|unknown) tier:s value:s linked_powers:a activation:o required_wielder:s set_pieces:a legend:s minor_facts:a",
  organization: "name:s description:s type:e(guild|faction|government|religion|family|cult|military|criminal|academic|mercantile|secret_society) leader:s members:a size:s goals:a methods:a beliefs:a allies:a enemies:a territory:a headquarters:s current_state:o founded:o history:s symbols:o hierarchy:a recruitment:s subsidiaries:a reputation:s strengths:a weaknesses:a minor_facts:a",
  event: "name:s description:s type:e(battle|ceremony|discovery|betrayal|reunion|departure|death|transformation|political|personal|supernatural) when:s where:s participants:a outcome:s significance:e(trivial|notable|major|pivotal) consequences:a related_plots:a cause:s witnesses:a items_involved:a phases:a how_remembered:s",
  plot: "name:s description:s type:e(main_quest|side_quest|character_arc|mystery|romance|political|personal_goal|background_thread) status:e(not_started|active|stalled|escalating|resolved|failed|abandoned) central_characters:a key_locations:a involved_organizations:a goal:s obstacles:a stakes:s current_progress:s recent_developments:a next_steps:s parent_plot:s themes:a stakes_per_character:so foreshadowing_planted:a structure_beat:s",
  threat: "name:s description:s nature:e(physical|social|supernatural|political|environmental|psychological|existential) scope:e(personal|local|regional|national|global|cosmic) severity:e(minor|notable|major|catastrophic|extinction_level) status:e(dormant|stirring|active|imminent|in_progress|averted|realized) source:o what_happens_if_unaddressed:s affected_targets:a counters:a weaknesses:a who_can_stop_it:a clues_revealed:a current_progress:s timeline:s knowledge_level:e(secret|rumored|public|common_knowledge) spread_mechanics:s tier:s",
  worldbuilding: "topic:s category:s description:s key_facts:a rules:a exceptions:a applies_to:a origin:s related_to:a examples:a embodied_by:a",
  summary: "title:s tagline:s summary:s parent_plot:s create_plot:o participants:a involved_locations:a significance:e(minor|moderate|major|pivotal) messages_covered:n turn_range:o key_moments:a consequences:a mood:e(light|comedic|tense|tragic|triumphant|melancholy|horrific|hopeful) pov_character:s foreshadowing_introduced:a",
  creature: "name:s tagline:s image_url:s classification:s rarity:e(common|uncommon|rare|legendary|mythical|unique) disposition:e(docile|cautious|neutral|aggressive|territorial|predatory) knowledge_level:e(unknown|rumored|observed|studied|mastered) description:s appearance:s habitat:s diet:s lifespan:s traits:a behaviors:a abilities:a ecology:o known_locations:a weaknesses:a cultural_significance:s tier:s bonded_to:s bond_type:e(owned|contracted|partnered|parasitic|bound|awakened|wild|summoned) linked_power:s reproduction:s social_structure:e(solitary|pack|hive|tribe|herd|swarm|colonial|symbiotic) intelligence:e(mindless|animal|cunning|sapient|hyperintelligent|cosmic) variants:a combat_tactics:s drops:a tameable:b taming_method:s strengths:a minor_facts:a",
  power: "name:s tagline:s description:s category:e(attack|defense|utility|healing|summoning|transformation|passive|ritual|knowledge|social|crafting|mobility|movement|special) mastery:e(nascent|learning|competent|mastered|legendary|reality_warping) source:e(innate|learned|gifted|awakened|stolen|inherited|acquired) tier:s users:a prerequisites:a cost:s range:s duration:s requirements:a limitations:a drawbacks:a effects:a variants:a parent_power:s related_powers:a lineage:s origin:s notable_uses:a",
};

/** Fields an entry of this type must carry (RoleCall's `required`). */
export const REQUIRED_FIELDS: Readonly<Record<EntryType, readonly string[]>> = {"character":["name"],"location":["name"],"item":["name"],"organization":["name"],"event":["name"],"plot":["name"],"threat":["name"],"worldbuilding":["topic","category","description"],"summary":["title","summary"],"creature":["name"],"power":["name"]};

type Kind = "s" | "n" | "b" | "a" | "o" | "so" | { oneOf: readonly string[] };

const FIELDS = Object.fromEntries(
  Object.entries(SPEC).map(([type, spec]) => [type, new Map(spec.split(" ").map((pair): [string, Kind] => {
    const [name, kind] = pair.split(":") as [string, string];
    return [name, kind.startsWith("e(") ? { oneOf: kind.slice(2, -1).split("|") } : (kind as Kind)];
  }))]),
) as Record<EntryType, Map<string, Kind>>;

/** The field names this type knows. */
export const knownFields = (type: EntryType): string[] => [...FIELDS[type].keys()];

export interface FieldIssue { field: string; expected: string }

const matches = (value: unknown, kind: Kind): boolean => {
  if (typeof kind === "object") return typeof value === "string" && kind.oneOf.includes(value);
  switch (kind) {
    case "s": return typeof value === "string";
    case "n": return typeof value === "number" && Number.isFinite(value);
    case "b": return typeof value === "boolean";
    case "a": return Array.isArray(value);
    case "o": return isRecord(value);
    case "so": return typeof value === "string" || isRecord(value);
  }
};

const describe = (kind: Kind): string => (typeof kind === "object" ? `one of ${kind.oneOf.join(", ")}` : { s: "text", n: "a number", b: "true or false", a: "a list", o: "an object", so: "text or an object" }[kind]);

export interface ParsedStructured {
  /** The data exactly as stored, unknown fields included. */
  data: Rec;
  /** Fields that are unknown to this type, kept and shown. */
  extras: string[];
  /** Known fields holding the wrong kind of value. */
  issues: FieldIssue[];
  /** Required fields that are absent or blank. */
  missing: string[];
}

/** Checks structured data against its type without changing or dropping anything. A null or undefined field counts as absent. */
export function parseStructured(type: EntryType, data: Rec): ParsedStructured {
  const fields = FIELDS[type];
  const extras: string[] = [];
  const issues: FieldIssue[] = [];
  for (const [field, value] of Object.entries(data)) {
    const kind = fields.get(field);
    if (kind === undefined) extras.push(field);
    else if (value !== null && value !== undefined && !matches(value, kind)) issues.push({ field, expected: describe(kind) });
  }
  const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  return { data, extras, issues, missing: REQUIRED_FIELDS[type].filter((f) => blank(data[f])) };
}
