/** Validate the complete authored Marinara folder-parent snapshot at the storage boundary. */
export function canReparentFolder(edges: ReadonlyMap<string, string | null>, folderId: string, newParentId: string | null, knownIds: ReadonlySet<string>): boolean {
  if (newParentId === null) return true;
  if (newParentId === folderId || !knownIds.has(newParentId)) return false;
  let cursor: string | null = newParentId;
  const seen = new Set<string>();
  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor);
    const parent: string | null = edges.get(cursor) ?? null;
    if (parent === folderId) return false;
    cursor = parent;
  }
  return true;
}

export function hasValidFolderParents(ids: readonly string[], parents: ReadonlyMap<string, string | null>): boolean {
  const known = new Set(ids);
  if (known.size !== ids.length || parents.size !== ids.length || [...parents.keys()].some((id) => !known.has(id))) return false;
  for (const id of ids) {
    const parent = parents.get(id);
    if (parent !== null && (parent === undefined || !known.has(parent))) return false;
    const seen = new Set([id]);
    let cursor: string | null | undefined = parent;
    while (cursor !== null && cursor !== undefined) {
      if (seen.has(cursor)) return false;
      seen.add(cursor);
      cursor = parents.get(cursor);
    }
  }
  return true;
}
