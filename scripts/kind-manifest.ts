/**
 * Writes the kind seams from the entity folders (every src/entities/<kind>/ with a kind.ts is a content kind):
 * src/generated/kinds.ts (identity, no zod) and src/generated/kind-schemas.ts (decoders and storage parts).
 * Run `bun run kinds`; `--check` fails when either is stale.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { kindProblems, type KindDescriptor } from "../src/entities/_shared/kind-descriptor";

const ROOT = join(import.meta.dir, "..");
const ENTITIES = join(ROOT, "src", "entities");

interface Found { folder: string; kind: KindDescriptor; parts: boolean }

/** Every kind folder, validated and sorted by display order; throws naming the folder on any problem. */
export async function findKinds(root = ENTITIES): Promise<Found[]> {
  const found: Found[] = [];
  const problems: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const dir = join(root, entry.name);
    if (!entry.isDirectory() || entry.name.startsWith("_") || !existsSync(join(dir, "kind.ts"))) continue;
    const kind = (await import(join(dir, "kind.ts"))).default as KindDescriptor;
    problems.push(...kindProblems(kind, entry.name));
    const decoder = join(dir, "runtime-schema.ts");
    if (!existsSync(decoder) || !/export const entitySchema\b/.test(readFileSync(decoder, "utf8"))) problems.push(`${entry.name}/runtime-schema.ts: must export entitySchema`);
    found.push({ folder: entry.name, kind, parts: existsSync(join(dir, "parts.ts")) });
  }
  const ids = new Set(found.map((f) => f.folder));
  for (const f of found) {
    const twin = found.find((g) => g !== f && g.kind.order === f.kind.order);
    if (twin) problems.push(`${f.folder}/kind.ts: order ${f.kind.order} is also ${twin.folder}'s`);
    for (const link of f.kind.links ?? []) if (!ids.has(link.to)) problems.push(`${f.folder}/kind.ts: link ${link.field} points at "${link.to}", which is not a kind`);
    const owner = f.kind.deck ? found.find((g) => g.folder === f.kind.deck) : undefined;
    if (f.kind.deck && (!owner || owner.kind.deck)) problems.push(`${f.folder}/kind.ts: deck "${f.kind.deck}" must be a kind with its own deck`);
  }
  if (problems.length > 0) throw new Error(`kinds:\n  ${problems.join("\n  ")}`);
  return found.sort((a, b) => a.kind.order - b.kind.order);
}

const HEADER = (what: string): string => `/**
 * Generated ${what}. Run \`bun run kinds\` to update it; do not edit it by hand.
 * The truth is src/entities/<kind>/ (kind.ts, runtime-schema.ts, parts.ts). Static imports, so the browser bundle and
 * the single-file builds reach every kind without walking a folder.
 */`;

export function renderKinds(found: readonly Found[]): string {
  return `${HEADER("kind seam (identity)")}
import type { CanonicalEntity } from "../core/canonical";
import type { KindDescriptor } from "../entities/_shared/kind-descriptor";
${found.map((f, i) => `import kind${i} from "../entities/${f.folder}/kind";`).join("\n")}

/** Every content kind, in display order. */
export const KINDS = [${found.map((_, i) => `kind${i}`).join(", ")}] as const;
/** Every kind id, in display order: the closed set of studio folders and canonical kinds. */
export const KIND_IDS = [${found.map((f) => `"${f.folder}"`).join(", ")}] as const;
export type KindId = (typeof KIND_IDS)[number];
type EntityOf<D> = D extends KindDescriptor<infer Id, infer Body> ? CanonicalEntity<Id, Body> : never;
/** Any canonical piece, as the union of every kind's. */
export type AnyKindEntity = EntityOf<(typeof KINDS)[number]>;

const BY_ID = new Map<string, KindDescriptor>(KINDS.map((k) => [k.id, k as KindDescriptor]));
/** A kind's descriptor, or undefined for an id that is not a kind. */
export const kindOf = (id: string): KindDescriptor | undefined => BY_ID.get(id);
export const isKindId = (value: unknown): value is KindId => typeof value === "string" && BY_ID.has(value);
`;
}

export function renderSchemas(found: readonly Found[]): string {
  const withParts = found.filter((f) => f.parts);
  return `${HEADER("kind seam (decoders and storage parts)")}
${found.map((f, i) => `import { entitySchema as schema${i} } from "../entities/${f.folder}/runtime-schema";`).join("\n")}
${withParts.map((f, i) => `import { parts as parts${i} } from "../entities/${f.folder}/parts";`).join("\n")}

/** Each kind's whole-entity decoder, in display order (the parse boundary's discriminated union). */
export const ENTITY_SCHEMAS = [${found.map((_, i) => `schema${i}`).join(", ")}] as const;
/** The kinds whose bodies split into item parts in storage (src/entities/kind-parts.ts). */
export const KIND_PARTS = { ${withParts.map((f, i) => `${f.folder}: parts${i}`).join(", ")} } as const;
`;
}

if (import.meta.main) {
  const found = await findKinds();
  const check = process.argv.includes("--check");
  const outputs = [["kinds.ts", renderKinds(found)], ["kind-schemas.ts", renderSchemas(found)]] as const;
  const stale = outputs.filter(([name, text]) => {
    const file = join(ROOT, "src", "generated", name);
    if ((existsSync(file) ? readFileSync(file, "utf8") : "") === text) return false;
    if (!check) writeFileSync(file, text);
    return check;
  });
  for (const [name] of stale) console.error(`kinds: src/generated/${name} is stale, run bun run kinds`);
  if (stale.length > 0) process.exit(1);
  console.log(`kinds: ${found.map((f) => f.folder).join(", ")}`);
}
