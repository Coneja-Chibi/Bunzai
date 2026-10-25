/**
 * The Cast dossier (RoleCall `lib/compendium/dossiers/cast.ts`): the book's characters as case files with their meters, pinned memories, relationships
 * and who is in the scene, and the digest the narrator reads. Built from character entries alone (RoleCall also merges the Story Director's
 * relationship events, which are not here), so a meter shows only where the entry carries one. The "[USE]" lines are RoleCall's.
 */
import { isRecord, type Rec } from "../../guards";
import type { CompendiumEntry } from "../read";
import { buildRelationshipGraph, normalizeName, type RelationshipEdge } from "../relationships";
import { aiContext, clamp, entriesOfType, labelize, lineLimit, readArray, readBool, readNumber, readRecord, readString, slug, type ContextProfile, type DossierAiContext } from "./base";

export interface CastMetric { id: string; label: string; value: number; max: number }
export interface CastMemory { id: string; slug: string; text: string; impact: "positive" | "negative" | "neutral" | "unknown"; weight: number }
export interface CastRelationship { target: string; targetId: string | null; nature: string | null; status: string | null; notes: string | null }
export interface CastMember {
  id: string; slug: string; name: string; role: string | null; category: string | null; affinity: number | null; trust: number | null;
  emotion: string | null; emotionIntensity: number | null; emotionCause: string | null; inScene: boolean; hiddenState: number; drift: number;
  metrics: CastMetric[]; memories: CastMemory[]; relationships: CastRelationship[];
}
export interface CastDossier {
  type: "cast"; title: "Cast";
  stats: { totalCast: number; activeCast: number; offstageCast: number; highAffinity: number; hostile: number; hiddenState: number; pinnedMemories: number; drift: number };
  cast: CastMember[]; edges: { source: string; target: string; nature: string | null }[]; mismatches: number;
  ai: DossierAiContext;
}

const impactOf = (v: string | null): CastMemory["impact"] => (v === "positive" || v === "negative" || v === "neutral" ? v : "unknown");

function metricsOf(sd: Rec): CastMetric[] {
  const out: CastMetric[] = [];
  const affinity = readNumber(sd, ["affinity"]), trust = readNumber(sd, ["trustLevel", "trust"]);
  if (affinity !== null) out.push({ id: "affinity", label: "Affinity", value: clamp(affinity, 0, 100), max: 100 });
  if (trust !== null) out.push({ id: "trust", label: "Trust", value: clamp(trust, 0, 100), max: 100 });
  for (const [key, raw] of Object.entries(readRecord(sd, ["dynamics"]))) if (typeof raw === "number" && Number.isFinite(raw)) out.push({ id: `dynamic-${key}`, label: labelize(key), value: clamp(raw, 0, 100), max: 100 });
  return out.slice(0, 10);
}

function memoriesOf(sd: Rec): CastMemory[] {
  const out: CastMemory[] = [];
  for (const item of readArray(sd, ["memories", "pinned_memories", "key_memories"])) {
    if (typeof item === "string") { out.push({ id: `m-${out.length}`, slug: slug(item), text: item, impact: "unknown", weight: 8 }); continue; }
    if (!isRecord(item) || item["discarded"] === true) continue;
    const r = item;
    const text = readString(r, ["text", "content", "summary"]);
    if (text) out.push({ id: readString(r, ["id"]) ?? `m-${out.length}`, slug: readString(r, ["slug"]) ?? slug(text), text, impact: impactOf(readString(r, ["impact", "sentiment"])), weight: readNumber(r, ["weight", "importance"]) ?? 7 });
  }
  const seen = new Set<string>();
  return out.filter((m) => (seen.has(m.slug) ? false : (seen.add(m.slug), true))).slice(0, 10);
}

function hiddenOf(sd: Rec): number {
  let n = 0;
  for (const key of ["currentThoughts", "current_thoughts", "hidden_knowledge", "hiddenKnowledge", "private_notes", "secrets"]) {
    const v = sd[key];
    if (typeof v === "string" && v.trim()) n++;
    if (Array.isArray(v)) n += v.length;
  }
  return n;
}

function memberOf(entry: CompendiumEntry, edges: readonly RelationshipEdge[]): CastMember {
  const sd = entry.data;
  const affinity = readNumber(sd, ["affinity"]), trust = readNumber(sd, ["trustLevel", "trust"]);
  const category = readString(sd, ["category", "relationship_category"]);
  return {
    id: entry.id, slug: slug(entry.name), name: entry.name, role: readString(sd, ["role", "archetype", "occupation", "title"]), category, affinity, trust,
    emotion: readString(sd, ["currentEmotion", "current_emotion", "emotion"]), emotionIntensity: readNumber(sd, ["emotionIntensity", "emotion_intensity"]),
    emotionCause: readString(sd, ["emotionCause", "emotion_cause"]),
    inScene: readBool(sd, ["scenePresence.isPresent", "scene_presence.is_present"]),
    hiddenState: hiddenOf(sd),
    drift: category === "unknown" ? 0 : (affinity !== null && affinity <= 25 ? 2 : 0) + (trust !== null && trust <= 25 ? 2 : 0),
    metrics: metricsOf(sd), memories: memoriesOf(sd),
    relationships: edges.map((e) => ({ target: e.resolvedTargetTitle ?? e.targetName, targetId: e.resolvedTargetEntryId ?? null, nature: e.nature ?? null, status: e.status ?? null, notes: e.notes ?? null })),
  };
}

const hostile = (m: CastMember): boolean => m.category === "enemy" || (m.category !== "unknown" && m.affinity !== null && m.affinity <= 25);

/** The narrator's digest (cast.ts:formatCastAiContext): who is in the scene (else the first of the cast) with their meters, a memory each, and the relationship edges. */
function digest(cast: readonly CastMember[], edges: CastDossier["edges"], profile: ContextProfile): string[] {
  const lines = ["[CAST]"];
  const active = cast.filter((m) => m.inScene).slice(0, lineLimit(profile, 6));
  for (const m of active.length > 0 ? active : cast.slice(0, lineLimit(profile, 6))) {
    const details = [m.category, m.affinity !== null ? `affinity ${m.affinity}` : null, m.trust !== null ? `trust ${m.trust}` : null, m.emotion ? `emotion ${m.emotion}${m.emotionIntensity !== null ? ` ${m.emotionIntensity}` : ""}` : null].filter(Boolean);
    lines.push(`- {${m.slug}} ${m.name}${details.length ? `: ${details.join("; ")}` : ""}.`);
    const memory = m.memories[0];
    if (memory && profile.mode !== "compact") lines.push(`  Memory {${memory.slug}}: ${memory.text}`);
  }
  const shown = profile.mode === "compact" ? [] : edges.slice(0, lineLimit(profile, 8));
  if (shown.length > 0) {
    lines.push("[RELATIONSHIPS]");
    for (const e of shown) lines.push(`- ${e.source} -> ${e.target}${e.nature ? ` (${e.nature})` : ""}.`);
  }
  lines.push("[USE]", "- Keep NPC emotions, affinity, trust, and recent memories consistent.", "- Do not expose private thoughts or hidden knowledge unless a dedicated visibility rule allows it.");
  return lines;
}

export function buildCast(entries: readonly CompendiumEntry[], profile: ContextProfile): CastDossier {
  const characters = entriesOfType(entries, "character");
  const graph = buildRelationshipGraph(characters);
  const cast = characters.map((e) => memberOf(e, graph.outgoing.get(normalizeName(e.title)) ?? []))
    .sort((a, b) => Number(b.inScene) - Number(a.inScene));
  const edges = [...graph.outgoing.values()].flat().slice(0, 80).map((e) => ({ source: e.sourceTitle, target: e.resolvedTargetTitle ?? e.targetName, nature: e.nature ?? null }));
  return {
    type: "cast", title: "Cast",
    stats: {
      totalCast: cast.length, activeCast: cast.filter((m) => m.inScene).length, offstageCast: cast.filter((m) => !m.inScene).length,
      highAffinity: cast.filter((m) => (m.affinity ?? 0) >= 75).length, hostile: cast.filter(hostile).length,
      hiddenState: cast.reduce((n, m) => n + m.hiddenState, 0), pinnedMemories: cast.reduce((n, m) => n + m.memories.filter((x) => x.weight >= 8).length, 0), drift: cast.reduce((n, m) => n + m.drift, 0),
    },
    cast, edges, mismatches: graph.mismatches.length, ai: aiContext(digest(cast, edges, profile), profile),
  };
}
