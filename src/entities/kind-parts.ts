/**
 * The drop-in contract a kind's own `parts.ts` declares: which array of its body splits into item parts, and how to read each
 * item's id. A kind with no `parts.ts` has no split items: piece-parts.ts falls back to head and
 * escrow parts only. Imported statically by each kind's own drop-in file and by piece-parts.ts's
 * small registry, the same way src/entities/runtime-schema.ts imports every kind's body schema:
 * decompose is a synchronous hot path, so the registry cannot scan the filesystem at call time.
 */
export interface KindParts<Item = unknown> {
  /** The body field (preset "prompts", lorebook "entries") that holds the item array. */
  itemsField: string;
  /** The stable authored id used to name that item's part ("i/<id>"). Not required to be unique;
   * piece-parts.ts suffixes a duplicate's later occurrences ("i/<id>#<n>"). */
  idOf: (item: Item) => string;
  /**
   * Validates one item on its own: a changed item is parsed with this schema alone, never the whole entity's, so a
   * one-block patch on a 30 MB preset costs one block's validation. A structural type (satisfied by
   * any Zod schema's own `.parse`), not `zod` itself, so this pure contract file never imports it.
   */
  itemSchema: { parse(data: unknown): Item };
}
