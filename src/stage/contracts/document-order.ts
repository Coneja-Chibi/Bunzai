/** Stable document order shared by content-store policy and opaque backend listings. */
import type { DocumentRow } from "./content-store";

export const compareDocumentOrder = (
  a: Pick<DocumentRow, "kind" | "id">,
  b: Pick<DocumentRow, "kind" | "id">,
): number => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
