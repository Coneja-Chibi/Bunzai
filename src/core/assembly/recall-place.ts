/**
 * Recall's block (04b D4, F11): the entries the Compendium's selector picked, as RoleCall injects them (`worker.ts:4111-4125`)
 * - one system message headed `[Retrieved World Knowledge]`, one `[Lore: <title>]` section per entry - but counted against
 * the lore share (RoleCall has no cap, `MAX_RETRIEVED_CHARS = Infinity`) and without the selector's reasoning, which stays in
 * the trace. An entry the lore engine already placed this turn is not repeated; one that does not fit is cut, in the selector's
 * order, and listed. Pure: the same picks, budget and lore keys give the same block.
 */
import { countText } from "../tokens";

export interface RecallEntry { entryKey: string; title: string; content: string }
export interface RecallHit { entryKey: string; title: string; tokens: number }

/** What recall may use when the request has no window to take a share of (no reply is ever sent without one in practice). */
export const RECALL_NO_WINDOW_TOKENS = 8_000;

/** The tokens of the window the lore engine and recall share (types.ts DEFAULT_LORE_SHARE): the one place the cap is worked out. */
export const loreShareTokens = (context: number, share: number): number => Math.floor(context * share);

export const RECALL_HEADER = "[Retrieved World Knowledge]";

export function placeRecall(entries: readonly RecallEntry[], budget: number, loreKeys: ReadonlySet<string>): { text: string; injected: RecallHit[]; cut: RecallHit[]; repeated: string[] } {
  const injected: RecallHit[] = [];
  const cut: RecallHit[] = [];
  const repeated: string[] = [];
  const sections: string[] = [];
  let left = budget - countText(RECALL_HEADER);
  for (const e of entries) {
    if (loreKeys.has(e.entryKey)) { repeated.push(e.entryKey); continue; }
    if (!e.content.trim()) continue;
    const section = `[Lore: ${e.title}]\n${e.content}`;
    const tokens = countText(section);
    if (tokens > left) { cut.push({ entryKey: e.entryKey, title: e.title, tokens }); continue; }
    left -= tokens;
    sections.push(section);
    injected.push({ entryKey: e.entryKey, title: e.title, tokens });
  }
  return { text: sections.length > 0 ? `${RECALL_HEADER}\n${sections.join("\n\n")}` : "", injected, cut, repeated };
}
