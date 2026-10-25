/**
 * The Compendium's live recaps for Summary-aware context truncation (RoleCall `tv_smart_context`, 04b Track D): the books the scene may
 * read, their enabled and unretired summary entries that carry a `turn_range`, as the assembler's recaps (core/assembly/summary-cut.ts).
 * Undefined while the Compendium or the setting is off, so the assembler keeps every message.
 */
import type { SummaryRecap } from "../core/assembly/summary-cut";
import { resolveCompendium } from "../core/compendium/defaults";
import { readEntry } from "../core/compendium/read";
import { isRecord } from "../core/guards";
import type { Chat } from "../stage/contracts/chat-store";
import { readable } from "./compendium-recall";
import type { LoadedTurn } from "./scene-turn-load";

export function recapsOf(chat: Chat, loaded: LoadedTurn): SummaryRecap[] | undefined {
  const c = resolveCompendium(chat.compendium);
  if (!c.on || !c.historian.smartContext) return undefined;
  return readable(chat, loaded).flatMap((book) => book.body.entries.flatMap((raw, order) => {
    const e = readEntry(raw, order);
    const range = e.type === "summary" && e.enabled && !e.retired && isRecord(e.data["turn_range"]) ? e.data["turn_range"] : undefined;
    const from = range?.["from"];
    const to = range?.["to"];
    return typeof from === "number" && typeof to === "number" && raw.content.trim() !== "" && Number.isFinite(from) && Number.isFinite(to) ? [{ entryKey: `${book.id}:${raw.id}`, title: e.name, content: raw.content, from, to }] : [];
  }));
}
