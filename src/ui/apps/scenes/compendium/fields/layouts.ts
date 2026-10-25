/**
 * What an entry page shows for each of the eleven types, in RoleCall's order and with its labels (the `FieldBlock` rows of
 * `components/compendium/details/*Detail.tsx`, 04b section 1.4), as data: one renderer draws them all, so a type is a table row
 * and not a component (04b A4 listed eleven files; rule 12 asks for the fewest lines). A block names its field by dotted path.
 * `tile` blocks sit three to a row and always draw (a blank is "-"); the rest draw only when they hold something. `first` takes
 * the first non-empty of several fields; `count` adds the list length to the label ("Powers 3"). Anything the table does not
 * name and the page header does not show is drawn under "Other Fields", so authored data is never dropped (D2).
 *
 * Where RoleCall reads a field its own schema never writes, this reads the schema's field too and names the deviation:
 * Affiliation (RoleCall `sd.affiliation`, else the schema's `affiliations` list, its first one), Grade (`sd.rank`; the schema has `tier`), Region / Type
 * (`region`, `location_type`; the schema has `type`).
 */
import type { EntryType } from "../../../../../core/compendium";

export interface Block { label: string; keys: string[]; tile?: boolean; first?: boolean; count?: boolean; arc?: boolean }
const t = (label: string, ...keys: string[]): Block => ({ label, keys, tile: true, first: true });
const b = (label: string, key: string, more: Partial<Block> = {}): Block => ({ label, keys: [key], ...more });
const group = (label: string, ...keys: string[]): Block => ({ label, keys });

/** Fields the page header already shows; never repeated under Other Fields. */
export const HEADER_FIELDS = new Set(["name", "title", "topic", "tagline", "subtitle", "description", "summary", "image_url", "aliases"]);

export const LAYOUTS: Readonly<Record<EntryType, readonly Block[]>> = {
  character: [
    t("Age", "age"), t("Affiliation", "affiliation", "affiliations"), t("Grade", "rank", "tier"),
    b("Character Arc", "arc", { arc: true }), b("Relationships", "relationships"), b("Memories", "memories"), b("Personality", "personality"), b("Stats", "notable_stats"), b("Voice", "voice"),
    b("Powers", "powers", { count: true }), b("Affiliations", "affiliations"), b("Possessions", "possessions"), b("Skills", "skills"), b("Languages", "languages"), b("Family", "family"),
    group("Preferences", "likes", "dislikes"), group("Strengths & Weaknesses", "strengths", "weaknesses"), b("Minor Facts", "minor_facts"), b("Reputation", "reputation"), b("Death", "death_details"),
  ],
  location: [
    t("Parent Location", "parent_location"), t("Region / Type", "region", "location_type", "type"),
    t("Climate", "climate"), t("Architecture", "architecture"), t("Controlling Faction", "controlling_faction"),
    b("Atmosphere", "atmosphere"), b("Connected Locations", "connected_to"), b("Key Residents", "inhabitants.key_residents", { count: true }), b("Factions Present", "inhabitants.factions_present"),
    b("Notable Items", "notable_items"), b("Dangers", "dangers"), b("Local Laws", "local_laws"), b("History", "history"), b("Minor Facts", "minor_facts"),
  ],
  item: [
    t("Owner", "current_owner"), t("Location", "current_location"), t("Condition", "condition"), t("Tier", "tier"), t("Value", "value"), t("Required Wielder", "required_wielder"),
    b("Linked Powers", "linked_powers"), b("Abilities", "abilities"), b("Drawbacks", "drawbacks"), b("Activation", "activation"), b("Set Pieces", "set_pieces"),
    b("Legend", "legend"), b("Provenance", "provenance"), b("History", "history"), b("Minor Facts", "minor_facts"),
  ],
  organization: [
    t("Leader", "leader"), t("Headquarters", "headquarters"),
    b("Members", "members", { count: true }), group("Alignments", "allies", "enemies"), b("Territory", "territory"), b("Founded", "founded"), b("Hierarchy", "hierarchy"),
    b("Symbols & Iconography", "symbols"), b("Subsidiaries", "subsidiaries"), b("Recruitment", "recruitment"), b("History", "history"), b("Reputation", "reputation"),
    group("Strengths & Weaknesses", "strengths", "weaknesses"), b("Minor Facts", "minor_facts"),
  ],
  event: [
    t("When", "when"), t("Where", "where"),
    b("Participants", "participants", { count: true }), b("Related Plots", "related_plots"), b("Consequences", "consequences"), b("Cause", "cause"), b("Phases", "phases"),
    b("Witnesses", "witnesses"), b("Items Involved", "items_involved"), b("How Remembered", "how_remembered"),
  ],
  plot: [
    t("Status", "status"), t("Type", "type"), t("Parent Plot", "parent_plot"),
    b("Current Progress", "current_progress"), b("Stakes", "stakes"), b("Next Steps", "next_steps"), b("Central Characters", "central_characters"), b("Key Locations", "key_locations"),
    b("Involved Organizations", "involved_organizations"), b("Themes", "themes"), b("Stakes per Character", "stakes_per_character"), b("Foreshadowing Planted", "foreshadowing_planted"), b("Structure Beat", "structure_beat"),
  ],
  threat: [
    t("Severity", "severity"), t("Status", "status"), t("Scope", "scope"),
    b("Source", "source"), b("Affected", "affected_targets"), b("Who Can Stop It", "who_can_stop_it"), b("Timeline", "timeline"), b("Knowledge", "knowledge_level"), b("Tier", "tier"), b("Spread Mechanics", "spread_mechanics"),
  ],
  worldbuilding: [
    t("Category", "category"), t("Domain", "domain"),
    b("Key Facts", "key_facts"), b("Rules", "rules"), b("Exceptions", "exceptions"), b("Examples", "examples"), b("Embodied By", "embodied_by"), b("Applies To", "applies_to"), b("Related Concepts", "related_to"), b("Origin", "origin"),
  ],
  summary: [
    t("Parent Plot", "parent_plot"), t("Turn Range", "turn_range"), t("Significance", "significance"),
    b("Key Moments", "key_moments"), b("Participants", "participants", { count: true }), b("Involved Locations", "involved_locations"), b("Consequences", "consequences"),
    b("Mood", "mood"), b("POV Character", "pov_character"), b("Foreshadowing Introduced", "foreshadowing_introduced"),
  ],
  creature: [
    b("Appearance", "appearance"), b("Traits", "traits"), b("Behaviors", "behaviors"), b("Abilities", "abilities"), b("Ecology", "ecology"), b("Known Locations", "known_locations"), b("Weaknesses", "weaknesses"),
    b("Cultural Significance", "cultural_significance"), group("Bonded To", "bonded_to", "bond_type", "linked_power"), b("Tier", "tier"), b("Intelligence", "intelligence"), b("Social Structure", "social_structure"),
    b("Reproduction", "reproduction"), b("Combat Tactics", "combat_tactics"), b("Variants", "variants"), b("Drops", "drops"), group("Tameable", "tameable", "taming_method"), b("Strengths", "strengths"), b("Minor Facts", "minor_facts"),
  ],
  power: [
    group("Mechanics", "category", "mastery", "source", "tier", "cost", "range", "duration"), group("Power Tree", "parent_power", "variants"), b("Wielders", "users", { count: true }), b("Effects", "effects"),
    b("Requirements", "requirements"), group("Limits & Costs", "limitations", "drawbacks"), b("Related Powers", "related_powers"), group("Lineage & Origin", "lineage", "origin"), b("Notable Uses", "notable_uses"),
  ],
};
