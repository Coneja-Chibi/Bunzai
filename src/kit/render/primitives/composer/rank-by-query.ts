/** Generic prefix-first ranking shared by the command and piece suggestion menus. */
export function rankByQuery<T>(
  items: readonly T[],
  query: string,
  match: { prefix(item: T): boolean; contains(item: T): boolean; compare(a: T, b: T): number },
): T[] {
  const prefix: T[] = [];
  const contains: T[] = [];
  for (const item of items) {
    if (match.prefix(item)) prefix.push(item);
    else if (match.contains(item)) contains.push(item);
  }
  return [...prefix.sort(match.compare), ...contains.sort(match.compare)];
}
