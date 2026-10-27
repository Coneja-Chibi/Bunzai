/**
 * Links between pieces: a body field holding the ids of pieces of another kind (a character's knowledgeRefs point at
 * lorebooks). Each kind declares its links in its kind.ts; this module is the one place that reads them, so the Nodes
 * view, the Press bundles, exports, imports and delete warnings all follow the same table.
 */
import { isRecord, strArray } from "./guards";
import { KINDS } from "../generated/kinds";
import type { KindLink } from "../entities/_shared/kind-descriptor";

/** One link, with the kind that holds it. */
export type LinkPort = KindLink & { from: string };
/** A piece one body links. */
export interface LinkRef { kind: string; id: string; field: string }

/** Every link any kind declares. */
export const LINK_PORTS: readonly LinkPort[] = KINDS.flatMap((k) => (k.links ?? []).map((l) => ({ from: k.id, ...l })));

/** The links a kind holds. */
export const portsOf = (kind: string): LinkPort[] => LINK_PORTS.filter((p) => p.from === kind);
/** The links that point at a kind. */
export const linksTo = (kind: string): LinkPort[] => LINK_PORTS.filter((p) => p.to === kind);

/** The ids in one link field of a body; anything that is not a list of strings reads as none. */
export const refsIn = (body: unknown, field: string): string[] => strArray(isRecord(body) ? body[field] : undefined);

/** Every piece a body of `kind` links, in the kind's link order; `embedded` keeps only the ones its file carries. */
export const linkedRefs = (kind: string, body: unknown, scope: "all" | "embedded" = "all"): LinkRef[] =>
  portsOf(kind).filter((p) => scope === "all" || p.embedded === true)
    .flatMap((p) => refsIn(body, p.field).map((id) => ({ kind: p.to, id, field: p.field })));

/**
 * The body with linked ids renamed after keep-both saves gave pieces new ids; `renamed` maps "kind:oldId" to the new
 * id. Ids not in the map are left as they are, never dropped.
 */
export function withLinksRenamed<B>(kind: string, body: B, renamed: ReadonlyMap<string, string>): B {
  if (!isRecord(body) || renamed.size === 0) return body;
  const out: Record<string, unknown> = { ...body };
  for (const p of portsOf(kind)) {
    if (!Array.isArray(out[p.field])) continue;
    out[p.field] = refsIn(body, p.field).map((id) => renamed.get(`${p.to}:${id}`) ?? id);
  }
  return out as B;
}

/** The linked pieces of a body read through `read`, split into the ones found and the ones that are gone. */
export async function resolveLinks<E>(
  kind: string,
  body: unknown,
  read: (kind: string, id: string) => Promise<E | null>,
  scope: "all" | "embedded" = "all",
): Promise<{ found: (LinkRef & { entity: E })[]; missing: LinkRef[] }> {
  const refs = linkedRefs(kind, body, scope);
  const entities = await Promise.all(refs.map((r) => read(r.kind, r.id)));
  const found: (LinkRef & { entity: E })[] = [];
  const missing: LinkRef[] = [];
  refs.forEach((r, i) => {
    const entity = entities[i];
    if (entity === null || entity === undefined) missing.push(r);
    else found.push({ ...r, entity });
  });
  return { found, missing };
}

/** Who can point at a piece of `kind`, in words ("character", "scene"): every kind that links to it, then scenes. */
export const referencedBy = (kind: string): string[] => [
  ...new Set(linksTo(kind).map((p) => KINDS.find((k) => k.id === p.from)?.singular.toLowerCase() ?? p.from)),
  ...(KINDS.find((k) => k.id === kind)?.sceneField ? ["scene"] : []),
];
