/**
 * Character relationships and the one-sided ones (RoleCall `lib/compendium/relationship-graph.ts`, the Reconcile
 * modal's count, 04b section 1.7). Walks every character's `structured_data.relationships[]` and returns who declares what
 * (`outgoing`), who is mentioned by whom (`incoming`, the "Referenced by" block), and every edge whose target is a real
 * character in the book but does not name the source back (`mismatches`). Pure: no I/O, no model.
 *
 * A target name is matched to a character by exact normalized title, else as a whole word of exactly one title ("Gojo"
 * finds "Satoru Gojo", but "Fushiguro" finds nothing when two characters share it: the person disambiguates).
 * A label disagreement is never a mismatch (`:236-239`); only silence is.
 */
import { recArray } from "../guards";
import type { CompendiumEntry } from "./read";

export interface RelationshipEdge {
  sourceTitle: string;
  sourceEntryId: string;
  /** The target exactly as the source wrote it; it may name no entry. */
  targetName: string;
  resolvedTargetEntryId?: string;
  resolvedTargetTitle?: string;
  nature?: string;
  status?: string;
  notes?: string;
}

export interface RelationshipMismatch { edge: RelationshipEdge; targetEntryId: string; targetTitle: string }

export interface RelationshipGraph {
  /** Normalized character title to the edges that character declares. */
  outgoing: Map<string, RelationshipEdge[]>;
  /** Normalized title to the edges that name that character (resolved), or the raw target name when none resolved. */
  incoming: Map<string, RelationshipEdge[]>;
  mismatches: RelationshipMismatch[];
  characterCount: number;
  edgeCount: number;
}

/** Lowercase, punctuation to spaces, spaces collapsed: the key every lookup uses (`:90-96`). Never shown. */
export const normalizeName = (name: string): string => name.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

type Known = Map<string, { id: string; title: string }>;

function resolveTarget(targetName: string, known: Known): { id: string; title: string } | undefined {
  const norm = normalizeName(targetName);
  if (!norm) return undefined;
  const exact = known.get(norm);
  if (exact) return exact;
  const padded = ` ${norm} `;
  const hits = [...known].filter(([title]) => ` ${title} `.includes(padded));
  return hits.length === 1 ? hits[0]![1] : undefined;
}

const optText = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

export function buildRelationshipGraph(entries: readonly CompendiumEntry[]): RelationshipGraph {
  const characters = entries.filter((e) => e.type === "character" && !e.retired && e.title);
  const known: Known = new Map();
  for (const c of characters) known.set(normalizeName(c.title), { id: c.id, title: c.title });

  const outgoing = new Map<string, RelationshipEdge[]>();
  const incoming = new Map<string, RelationshipEdge[]>();
  let edgeCount = 0;
  for (const c of characters) {
    const sourceKey = normalizeName(c.title);
    if (!sourceKey) continue;
    const mine: RelationshipEdge[] = [];
    for (const rel of recArray(c.data["relationships"])) {
      const targetName = typeof rel["with"] === "string" ? rel["with"].trim() : "";
      if (!targetName) continue;
      const to = resolveTarget(targetName, known);
      const edge: RelationshipEdge = {
        sourceTitle: c.title, sourceEntryId: c.id, targetName,
        ...(to ? { resolvedTargetEntryId: to.id, resolvedTargetTitle: to.title } : {}),
        ...(optText(rel["nature"]) === undefined ? {} : { nature: rel["nature"] as string }),
        ...(optText(rel["status"]) === undefined ? {} : { status: rel["status"] as string }),
        ...(optText(rel["notes"]) === undefined ? {} : { notes: rel["notes"] as string }),
      };
      mine.push(edge);
      edgeCount += 1;
      const key = to ? normalizeName(to.title) : normalizeName(targetName);
      incoming.set(key, [...(incoming.get(key) ?? []), edge]);
    }
    if (mine.length > 0) outgoing.set(sourceKey, mine);
  }

  const mismatches: RelationshipMismatch[] = [];
  for (const edges of outgoing.values()) {
    for (const edge of edges) {
      if (edge.resolvedTargetEntryId === undefined || edge.resolvedTargetTitle === undefined) continue;
      const sourceKey = normalizeName(edge.sourceTitle);
      const back = (outgoing.get(normalizeName(edge.resolvedTargetTitle)) ?? []).some((e) => e.resolvedTargetEntryId === edge.sourceEntryId || normalizeName(e.targetName) === sourceKey);
      if (!back) mismatches.push({ edge, targetEntryId: edge.resolvedTargetEntryId, targetTitle: edge.resolvedTargetTitle });
    }
  }
  return { outgoing, incoming, mismatches, characterCount: characters.length, edgeCount };
}

/** Everyone who names this character, for the "Referenced by" block (`:256-262`). */
export const backlinksOf = (graph: RelationshipGraph, title: string): RelationshipEdge[] => graph.incoming.get(normalizeName(title)) ?? [];

/** The relationship a mirror adds to the target: the source named back, unknown nature and status when the source gave none (`mirror-relationship/route.ts:122-127`). */
export const mirrorOf = (edge: RelationshipEdge): { with: string; nature: string; status: string; notes: string } =>
  ({ with: edge.sourceTitle.trim(), nature: (edge.nature || "unknown").trim(), status: (edge.status || "unknown").trim(), notes: (edge.notes || "").trim() });

/** Whether the target already names the source, case-insensitively, so a mirror adds nothing twice (`route.ts:112-120`). */
export const alreadyMirrored = (target: CompendiumEntry, sourceTitle: string): boolean =>
  recArray(target.data["relationships"]).some((r) => typeof r["with"] === "string" && r["with"].trim().toLowerCase() === sourceTitle.trim().toLowerCase());
