/**
 * Bundle grouping for the Press queue (the locked vs-press-room-1 wire): a staged piece with LINKS
 * is a bundle - its linked pieces (whatever its kind declares, core/links.ts) ride with it, droppable per run. A character's
 * lorebooks (body.knowledgeRefs) ride him; a preset's regex sets (body.behaviorRefs) and
 * quick-reply sets (body.quickReplyRefs) ride it, which is what the preset schema has promised
 * since behaviorRefs landed ("export decides whether to embed, and reports a set that could not
 * ride rather than dropping it") - the Press simply never read the field, so a preset's regex left
 * the building alone and the zip looked "stripped". Staged pieces nobody links ride solo. Pure
 * over summaries + fetched bodies; the room owns fetching.
 */
import type { StudioEntitySummary } from "../../app-contract";
import { isRecord } from "../../../core/guards";
import { LINK_PORTS, linkedRefs } from "../../../core/links";

export const pieceKeyOf = (p: { id: string; kind: string }): string => `${p.kind}:${p.id}`;

/** A link to a rider: which kind it is, and which id. Refs of different kinds must not collide. */
export interface RiderRef {
  kind: string;
  id: string;
}

/**
 * Every rider a fetched OWNER entity links, kind included: whatever its kind declares as links (core/links.ts), so a
 * character brings its lorebooks and regex sets, a persona its lorebooks, a preset its regex and quick-reply sets. An
 * unknown shape links nothing rather than guessing.
 */
export function riderRefsOf(owner: { kind: string }, entity: unknown): RiderRef[] {
  if (!isRecord(entity)) return [];
  return linkedRefs(owner.kind, entity.body).map(({ kind, id }) => ({ kind, id }));
}

export interface PressBundle {
  owner: StudioEntitySummary;
  /** linked lorebooks riding with the owner (resolved against the studio's summaries) */
  riders: StudioEntitySummary[];
}

export interface BundleGrouping {
  bundles: PressBundle[];
  solos: StudioEntitySummary[];
}

/** The kinds that can OWN a bundle (the ones that link pieces); everything else is only ever a solo or a rider. */
const OWNER_KINDS = new Set(LINK_PORTS.map((p) => p.from));

/**
 * Group the staged queue into bundles and solos. Riders resolve from the WHOLE studio's summaries (a
 * linked piece rides even when it was never separately staged); a staged piece that already rides
 * some staged owner's bundle is not doubled as a solo. Queue order is preserved.
 */
export function groupBundles(
  queue: readonly StudioEntitySummary[],
  allSummaries: readonly StudioEntitySummary[],
  refsByOwner: Readonly<Record<string, readonly RiderRef[]>>,
): BundleGrouping {
  const bundles: PressBundle[] = [];
  const ridden = new Set<string>();

  for (const p of queue) {
    if (!OWNER_KINDS.has(p.kind)) continue;
    const refs = refsByOwner[pieceKeyOf(p)] ?? [];
    const riders = refs
      .map((ref) => allSummaries.find((s) => s.kind === ref.kind && s.id === ref.id))
      .filter((s): s is StudioEntitySummary => s !== undefined);
    for (const r of riders) ridden.add(pieceKeyOf(r));
    bundles.push({ owner: p, riders });
  }

  const solos = queue.filter((p) => !OWNER_KINDS.has(p.kind) && !ridden.has(pieceKeyOf(p)));
  return { bundles, solos };
}

/** Every piece a run prints, in order: bundle owners with their (non-dropped) riders, then solos. */
export function runSet(
  grouping: BundleGrouping,
  dropped: ReadonlySet<string>,
): StudioEntitySummary[] {
  const out: StudioEntitySummary[] = [];
  for (const bundle of grouping.bundles) {
    out.push(bundle.owner);
    for (const r of bundle.riders) if (!dropped.has(pieceKeyOf(r))) out.push(r);
  }
  for (const s of grouping.solos) out.push(s);
  return out;
}

/** What a finished run hands the browser: the one file bare, or a zip when there are several. */
export type RunPackaging<T = Uint8Array> =
  | { kind: "single"; filename: string; bytes: T }
  | { kind: "zip"; files: Record<string, T> };

/**
 * ONE PIECE IN, ONE FILE OUT. A run that printed exactly one file downloads that file under its own
 * name - a person exporting one preset was handed a zip with one thing in it, which reads as
 * ceremony and costs an unzip on the other end. The zip earns its place only when there is a
 * bundle to hold together.
 */
export function packageRun<T>(files: Readonly<Record<string, T>>): RunPackaging<T> | null {
  const names = Object.keys(files);
  if (names.length === 0) return null;
  if (names.length === 1) {
    const name = names[0]!;
    return { kind: "single", filename: name, bytes: files[name]! };
  }
  return { kind: "zip", files: { ...files } };
}
