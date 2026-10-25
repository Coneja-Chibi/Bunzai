/**
 * The Compendium snapshot in the planner's prompt (RoleCall `dm-stream/compendium-bridge.ts:53-206`): a short "[COMPENDIUM CONTEXT]" block of at most 15 characters with their
 * relationships, 5 locations and 5 unresolved tensions, read from the books' typed entries. Pure; the caller passes only the books the Compendium may read (`canRead`), so a book it may not
 * read is never in it. One deliberate difference: RoleCall picks the first entries in database order (map 13 #16). Here the characters come from the scene first: those named in the recent
 * messages or by the card and the persona, then the characters they have relationships with, then the person's featured entries, then book order; locations the same way, with the places
 * the scene's characters are at. Retired and disabled entries and entries of other types are left out.
 */
import type { LorebookEntry } from "../../entities/lorebook/schema";
import { isRecord, recArray, str } from "../guards";
import { readBook, type CompendiumEntry } from "../compendium/read";
import { normalizeName } from "../compendium/relationships";

export const SNAPSHOT_CHARACTERS = 15;
export const SNAPSHOT_LOCATIONS = 5;
export const SNAPSHOT_TENSIONS = 5;
export const SNAPSHOT_RELATIONSHIPS = 5;

interface Relationship { with: string; nature: string; status?: string; notes?: string }

export interface SceneHints {
  /** The recent messages' text, newest last. */
  recent: readonly string[];
  /** The card's and the persona's names. */
  names: readonly string[];
}

const opt = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined);

function relationshipsOf(e: CompendiumEntry): Relationship[] {
  return recArray(e.data["relationships"]).map((r) => ({ with: opt(r["with"]) ?? "unknown", nature: opt(r["nature"]) ?? "unknown", ...(opt(r["status"]) ? { status: str(r["status"]) } : {}), ...(opt(r["notes"]) ? { notes: str(r["notes"]) } : {}) }));
}

function stateOf(e: CompendiumEntry): string | undefined {
  const s = isRecord(e.data["current_state"]) ? e.data["current_state"] : undefined;
  if (!s) return undefined;
  const parts = [s["status"] && s["status"] !== "alive" ? `Status: ${str(s["status"])}` : "", opt(s["condition"]) ?? "", opt(s["location"]) ? `At: ${str(s["location"])}` : ""].filter(Boolean);
  return parts.length > 0 ? parts.join(". ") : undefined;
}

/** Whether a name (or an alias) of the entry appears as whole words in the text. */
function mentioned(e: CompendiumEntry, text: string): boolean {
  return [e.name, ...e.aliases].map(normalizeName).some((n) => n.length > 1 && ` ${text} `.includes(` ${n} `));
}

export function buildCompendiumContext(books: readonly { entries: readonly LorebookEntry[] }[], hints: SceneHints): string {
  const all = books.flatMap((b) => readBook(b.entries)).filter((e) => e.enabled && !e.retired);
  const characters = all.filter((e) => e.type === "character");
  const locations = all.filter((e) => e.type === "location");
  if (characters.length === 0 && locations.length === 0) return "";
  const text = normalizeName(hints.recent.join("\n"));
  const named = new Set(hints.names.map(normalizeName).filter(Boolean));
  const inScene = characters.filter((c) => mentioned(c, text) || [c.name, ...c.aliases].map(normalizeName).some((n) => named.has(n)));
  // The characters the scene's characters are related to come next (RoleCall's expansion), then what the person featured, then book order.
  const related = new Set(inScene.flatMap((c) => relationshipsOf(c).map((r) => normalizeName(r.with))));
  const rank = (c: CompendiumEntry): number => (inScene.includes(c) ? 0 : [c.name, ...c.aliases].map(normalizeName).some((n) => related.has(n)) ? 1 : c.featured ? 2 : 3);
  const chosen = [...characters].sort((a, b) => rank(a) - rank(b) || a.order - b.order).slice(0, SNAPSHOT_CHARACTERS);
  const places = new Set(inScene.map((c) => normalizeName(opt(isRecord(c.data["current_state"]) ? c.data["current_state"]["location"] : undefined) ?? "")).filter(Boolean));
  const placeRank = (l: CompendiumEntry): number => (mentioned(l, text) || [l.name, ...l.aliases].map(normalizeName).some((n) => places.has(n)) ? 0 : l.featured ? 1 : 2);
  const spots = [...locations].sort((a, b) => placeRank(a) - placeRank(b) || a.order - b.order).slice(0, SNAPSHOT_LOCATIONS);

  const out: string[] = ["[COMPENDIUM CONTEXT]"];
  if (chosen.length > 0) {
    out.push("Characters:");
    for (const c of chosen) {
      const description = opt(c.data["description"]);
      const role = opt(c.data["role"]);
      const state = stateOf(c);
      out.push(`  - ${c.name}${description ? `: ${description}` : ""}${role ? ` (${role})` : ""}${state ? `. ${state}` : ""}`);
      const rels = relationshipsOf(c);
      if (rels.length > 0) out.push(`    Relationships: ${rels.slice(0, SNAPSHOT_RELATIONSHIPS).map((r) => `${r.with} (${r.nature}${r.status && r.status !== "active" ? `, ${r.status}` : ""})`).join(", ")}`);
    }
  }
  const tensions = chosen.flatMap((c) => relationshipsOf(c).filter((r) => r.status === "strained" || r.nature === "rival" || r.nature === "enemy").map((r) => `  Tension: ${c.name} / ${r.with}: ${r.nature} relationship (${r.status || "active"})${r.notes ? `: ${r.notes}` : ""}`)).slice(0, SNAPSHOT_TENSIONS);
  if (tensions.length > 0) out.push("\nUnresolved Tensions:", ...tensions);
  if (spots.length > 0) {
    out.push("\nKey Locations:");
    for (const l of spots) out.push(`  - ${l.name}${opt(l.data["description"]) ? `: ${str(l.data["description"])}` : ""}`);
  }
  return out.join("\n");
}
