/** How a typed `kind:` value matches a deck kind, shared by the UI and the search worker; the words come from the kind hub. */
import { kindOf } from "../../generated/kinds";

/** True when `value` starts the kind's id, its short tag, or any word of its plural or extra search words. */
export const matchesKindAlias = (kind: string, value: string): boolean => {
  const k = kindOf(kind);
  const words = k
    ? [k.short, ...[k.plural, ...(k.searchWords ?? [])].flatMap((w) => w.toLowerCase().split(/\s+/))]
    : [kind.slice(0, 4), `${kind}s`];
  return kind.startsWith(value) || words.some((word) => word.startsWith(value));
};
