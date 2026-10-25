/**
 * Whitelist/blacklist an entry to specific characters by name or tag. Ported verbatim from
 * RoleCall's matching/character-filter.ts onto canonical CharacterFilter.
 */
import type { CharacterFilter } from "../../../entities/lorebook/schema";

export function passesCharacterFilter(
  filter: CharacterFilter | null,
  character: { name: string; tags: string[] },
): boolean {
  if (!filter) return true;
  const hasNameFilter = filter.names.length > 0;
  const hasTagFilter = filter.tags.length > 0;
  if (!hasNameFilter && !hasTagFilter) return true;

  const nameMatch = hasNameFilter && filter.names.some((n) => n.toLowerCase() === character.name.toLowerCase());
  const tagMatch =
    hasTagFilter && filter.tags.some((ft) => character.tags.some((ct) => ct.toLowerCase() === ft.toLowerCase()));
  const matches = nameMatch || tagMatch;

  return filter.isExclude ? !matches : matches;
}
