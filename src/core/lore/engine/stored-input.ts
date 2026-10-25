/** Private revision trust for one deeply immutable body returned by the encrypted store. */
import type { LorebookBody } from "../../../entities/lorebook/schema";
import type { LoreBookInput } from "./types";
import { isSha256Hex } from "../../sha256";

const revisions = new WeakMap<LorebookBody, { id: string; revision: string }>();

function freezeOwned(root: object): boolean {
  const seen = new WeakSet<object>();
  const pending = [root];
  const owned: object[] = [];
  while (pending.length) {
    const value = pending.pop()!;
    if (seen.has(value)) continue;
    seen.add(value);
    owned.push(value);
    const prototype = Object.getPrototypeOf(value);
    if ((!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) || ArrayBuffer.isView(value)) return false;
    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) return false;
      if (descriptor.value !== null && typeof descriptor.value === "object") pending.push(descriptor.value);
    }
  }
  for (let i = owned.length - 1; i >= 0; i--) Object.freeze(owned[i]);
  return true;
}

/** Called only with the exact deep-frozen body and revision decoded from one store row. */
export function createStoredLoreInput(id: string, body: LorebookBody, revision: string): LoreBookInput {
  if (!isSha256Hex(revision) || !freezeOwned(body)) throw new TypeError("stored lore requires its owned body and canonical revision");
  revisions.set(body, { id, revision });
  return { id, name: body.name, body };
}

/** A different body or id has no trusted revision and must be structurally fingerprinted. */
export function getStoredLoreRevision(book: LoreBookInput): string | undefined {
  const stored = revisions.get(book.body);
  return stored?.id === book.id ? stored.revision : undefined;
}
