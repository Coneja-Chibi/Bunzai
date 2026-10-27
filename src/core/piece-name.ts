/**
 * Where a piece keeps its name, from its kind's descriptor (`namePath`, default `name`; a character's is identity.name).
 * The one reader and the one writer, so a piece is named the same way on the shelf, in receipts, in the CLI and in Kit,
 * and renaming it writes the field the kind actually reads.
 */
import { isRecord } from "./guards";
import { kindOf } from "../generated/kinds";

const pathOf = (kind: string): readonly string[] => kindOf(kind)?.namePath ?? ["name"];

/** The body's own name for a piece of `kind`, or "" when it has none. */
export function pieceName(kind: string, body: unknown): string {
  let at: unknown = body;
  for (const key of pathOf(kind)) at = isRecord(at) ? at[key] : undefined;
  return typeof at === "string" ? at : "";
}

/** The body with the piece's name set, leaving everything else as it was. */
export function withPieceName<B>(kind: string, body: B, name: string): B {
  const [head, ...rest] = pathOf(kind);
  const set = (node: unknown, key: string, path: readonly string[]): Record<string, unknown> => {
    const copy: Record<string, unknown> = isRecord(node) ? { ...node } : {};
    const [next, ...more] = path;
    copy[key] = next === undefined ? name : set(copy[key], next, more);
    return copy;
  };
  return set(body, head!, rest) as B;
}
