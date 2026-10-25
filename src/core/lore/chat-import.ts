/**
 * ST chat jsonl reader for Rehearsal Playback. Tolerant: junk lines skipped.
 * Shape: {name, is_user, mes} per line.
 */
/** One line of a chat, as the lore tools scan it. */
export interface ScanLine {
  text: string;
  role: "user" | "assistant" | "system";
}
import { isRecord } from "../guards";

export interface ImportedChat {
  lines: ScanLine[];
  speakers: string[];
  skipped: number;
}


/**
 * Parse ST (or ST-like) chat export text. Returns what parsed; never throws on bad lines.
 */
export function parseChatJsonl(raw: string): ImportedChat {
  const lines: ScanLine[] = [];
  const speakers = new Set<string>();
  let skipped = 0;
  const text = typeof raw === "string" ? raw : "";
  for (const row of text.split(/\r?\n/)) {
    const trimmed = row.trim();
    if (!trimmed) continue;
    try {
      const obj: unknown = JSON.parse(trimmed);
      if (!isRecord(obj)) {
        skipped += 1;
        continue;
      }
      const mes = typeof obj.mes === "string" ? obj.mes : typeof obj.message === "string" ? obj.message : null;
      if (mes === null) {
        skipped += 1;
        continue;
      }
      const isUser = obj.is_user === true || obj.is_user === 1 || obj.role === "user";
      const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : isUser ? "User" : "Char";
      speakers.add(name);
      lines.push({
        text: mes,
        role: isUser ? "user" : "assistant",
      });
    } catch {
      skipped += 1;
    }
  }
  return { lines, speakers: [...speakers], skipped };
}
