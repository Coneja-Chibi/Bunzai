/**
 * The SQLite ChatStore's summaries: one sealed cell, `chats.summary_json` (migration 41), holding the scene's settings, its last failure and a text per
 * take. The read, the change and the write are one transaction, so a person's edit and an automatic run never overwrite each other unseen; a guarded write is refused whole when the take's
 * text was written since it was read. A write drops the texts of takes that no longer exist in any form (the Trash keeps its rows, so a restored take keeps its text).
 */
import { StudioConflictError } from "../../../studio/atomic-file";
import type { ChatStore, SummarySettings, TakeSummary } from "../../contracts/chat-store";
import { checkSummaryError, checkSummarySettings, checkTakeSummary, mergeSummarySettings } from "../summary-rules";
import type { ChatSqlKit } from "./chat-store-cuts";

const COLUMN = "chats.summary_json";

export interface SummaryCell { settings?: SummarySettings; error?: string; takes?: Record<string, TakeSummary> }

export function summaryMethods(k: ChatSqlKit): Pick<ChatStore, "setSummarySettings" | "setSummaryError" | "summaryOf" | "setSummary"> {
  const read = (chatId: string, live: boolean): SummaryCell | null => {
    const row = k.one<{ summary_json: string | null }>(`SELECT summary_json FROM chats WHERE id = ?${live ? " AND deleted_at IS NULL" : ""}`, chatId);
    if (!row) return null;
    return row.summary_json === null ? {} : (JSON.parse(k.cipher.open(COLUMN, row.summary_json)) as SummaryCell);
  };
  const write = (chatId: string, cell: SummaryCell): void => {
    const takes = cell.takes && Object.keys(cell.takes).length > 0 ? cell.takes : undefined;
    const next: SummaryCell = { ...(cell.settings ? { settings: cell.settings } : {}), ...(cell.error ? { error: cell.error } : {}), ...(takes ? { takes } : {}) };
    k.run("UPDATE chats SET summary_json = ? WHERE id = ?", Object.keys(next).length > 0 ? k.cipher.seal(COLUMN, JSON.stringify(next)) : null, chatId);
  };
  const change = async (chatId: string, edit: (cell: SummaryCell) => SummaryCell) => {
    const found = await k.write(() => {
      const cell = read(chatId, true);
      if (!cell) return false;
      write(chatId, edit(cell));
      return true;
    });
    return found ? k.toChat(k.chatRow(chatId)!) : null;
  };
  return {
    setSummarySettings(chatId, patchRaw) {
      const patch = checkSummarySettings(patchRaw);
      return change(chatId, (cell) => ({ ...cell, settings: mergeSummarySettings(cell.settings, patch) }));
    },
    setSummaryError(chatId, errorRaw) {
      const error = checkSummaryError(errorRaw);
      return change(chatId, ({ error: _old, ...cell }) => (error ? { ...cell, error } : cell));
    },
    async summaryOf(branchId) {
      const branch = k.branchRow(branchId);
      return branch ? (read(branch.chat_id, false)?.takes?.[branchId] ?? null) : null;
    },
    async setSummary(branchId, inputRaw, guard) {
      const input = checkTakeSummary(inputRaw);
      return k.write(() => {
        const branch = k.writableBranch(branchId);
        const cell = branch ? read(branch.chat_id, true) : null;
        if (!branch || !cell) return null;
        const old = cell.takes?.[branchId];
        if (guard && (old?.at ?? null) !== guard.at) throw new StudioConflictError("the summary changed since it was read");
        const present = new Set((k.database.statement("SELECT id FROM branches WHERE chat_id = ?").all(branch.chat_id) as { id: string }[]).map((b) => b.id));
        const kept = Object.fromEntries(Object.entries(cell.takes ?? {}).filter(([id]) => id !== branchId && present.has(id)));
        const summary: TakeSummary | null = input ? { text: input.text, through: input.through, at: Math.max(k.clock(), (old?.at ?? 0) + 1), ...(input.last ? { last: input.last } : {}) } : null;
        write(branch.chat_id, { ...cell, takes: summary ? { ...kept, [branchId]: summary } : kept });
        return { summary };
      });
    },
  };
}
