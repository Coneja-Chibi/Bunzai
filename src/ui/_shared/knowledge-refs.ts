/**
 * Rewrite an archive piece's lorebook links against a minted-id-to-real-id map - the ONE implementation, shared by
 * the import sheet's commit loop (deck-core.ts) and the server's staged-row commit (server-staging.ts), so the two can
 * never drift. Which fields are lorebook links comes from the shared link table (core/links.ts): a character's and a
 * persona's knowledgeRefs today, any kind that links lorebooks tomorrow. Archives (`.lvbak`) carry their lorebooks as
 * separate rows, so this map only ever holds lorebook ids; other links are left alone.
 *
 * An id with no entry in `idMap` is DROPPED, not left pointing at an id that will never exist on the shelf - the same
 * precedent as the archive importer's own resolveKnowledgeRef (src/formats/lumiverse-archive/personas.ts): a
 * reference that cannot resolve is worse than none.
 */
import { portsOf, refsIn } from "../../core/links";

export function rewriteKnowledgeRefsFor(entity: unknown, idMap: ReadonlyMap<string, string>): unknown {
  const e = entity as { kind?: unknown; body?: Record<string, unknown> } | null;
  if (!e?.body || typeof e.kind !== "string") return entity;
  let nextBody: Record<string, unknown> | null = null;
  for (const { field } of portsOf(e.kind).filter((p) => p.to === "lorebook")) {
    if (!Array.isArray(e.body[field]) || (e.body[field] as unknown[]).length === 0) continue;
    const rewritten = refsIn(e.body, field).map((r) => idMap.get(r)).filter((r): r is string => r !== undefined);
    nextBody ??= { ...e.body };
    if (rewritten.length > 0) nextBody[field] = rewritten;
    else delete nextBody[field];
  }
  return nextBody ? { ...(entity as Record<string, unknown>), body: nextBody } : entity;
}
