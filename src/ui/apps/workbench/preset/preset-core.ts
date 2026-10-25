/** Pure helpers the preset editor leans on: entity parsing, edit touches, selection flips, group reveal. */
import { OccurrenceIndex, type EditorTouch } from "../../../_shared/editor-state";
import type { PresetBody, PresetPrompt } from "../../../../entities/preset";
import type { ParsedCanonicalEntity } from "../../../../entities/runtime-schema";
import { isRecord, recOr } from "../../../../core/guards";

/** Toggle `id` in a Set-shaped selection, immutably. Module scope on purpose: every row handler
 * closes over this inside a `useCallback([])`, and a component-scoped version recreated
 * every render would need to be a dependency, defeating that stability. */
export function flip(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function promptTouch(id: string, index: OccurrenceIndex<PresetPrompt>): EditorTouch<PresetBody> {
  return {
    key: `prompt:${id}`,
    read: (body) => index.positions(id).map((at) => body.prompts[at]).filter((prompt): prompt is PresetPrompt => Boolean(prompt)),
    write: (body, value) => {
      const replacements = value as PresetPrompt[];
      const prompts = [...body.prompts];
      index.positions(id).forEach((at, occurrence) => { if (replacements[occurrence]) prompts[at] = replacements[occurrence]!; });
      return { ...body, prompts };
    },
    items: (body) => {
      return Object.fromEntries(index.positions(id).flatMap((at) => {
        const name = index.nameAt(at);
        return name && body.prompts[at] ? [[name, body.prompts[at]] as const] : [];
      }));
    },
  };
}

export function bodyFieldTouch<K extends keyof PresetBody>(field: K): EditorTouch<PresetBody> {
  return {
    key: String(field),
    read: (body) => body[field],
    write: (body, value) => ({ ...body, [field]: value }),
  };
}

export function bodyFromEntity(entity: unknown): PresetBody {
  const e = recOr(entity);
  const b = isRecord(e.body) ? (e.body as unknown as PresetBody) : null;
  if (b && typeof b.name === "string" && Array.isArray(b.prompts)) return structuredClone(b);
  return { name: "Untitled preset", prompts: [] };
}

export function editablePreset(entity: unknown, id: string): ParsedCanonicalEntity {
  if (!isRecord(entity) || entity.kind !== "preset" || entity.id !== id || !isRecord(entity.body)) {
    throw new Error("The preset response did not contain a canonical body");
  }
  return entity as unknown as ParsedCanonicalEntity;
}

/** The group ids a block sits under, nearest first, so revealing it can open every collapsed ancestor. */
export function groupAncestors(body: PresetBody, blockId: string): Set<string> {
  const block = body.prompts.find((prompt) => prompt.id === blockId);
  const byId = new Map((body.groups ?? []).map((group) => [group.id, group] as const));
  const ancestors = new Set<string>();
  let groupId = block?.groupId;
  while (groupId && !ancestors.has(groupId)) {
    ancestors.add(groupId);
    groupId = byId.get(groupId)?.parentGroupId;
  }
  return ancestors;
}
