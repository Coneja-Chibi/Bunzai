/**
 * A host whose lorebook editor imports SillyTavern world info JSON (JanitorAI's Scripts "Import JSON",
 * Saucepan's Lorebook Importer): the ST worldbook codec under the host's own id, export only, so the
 * Press can print a host's lore beside its cards. It never bids on detection; ST reads those files.
 */
import type { LorebookAdapter } from "../../core/adapter";
import stWorldbook from "../sillytavern/lorebook";

export function hostWorldbook(id: string, label: string): LorebookAdapter {
  return { ...stWorldbook, id, label, escrowFormatIds: [stWorldbook.id], detect: () => 0 };
}
