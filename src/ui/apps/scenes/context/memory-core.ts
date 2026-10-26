/**
 * The Memory tab's pure rules (RoleCall `MemoryPanel.tsx`, rc-parity 08): the words for the current settings (the stat tiles, the sentence under Summary Controls, the hero's subtitle) and the patches its controls
 * make, each a few keys of ChatStore rule 45's settings. The couplings are RoleCall's: switching automation on from an interval of 0 gives it 60 so it never reads On while it cannot run, typing an interval turns
 * automation on or off, and turning on Hide messages already covered picks a Keep recent. No React.
 */
import { SUMMARY_DEFAULTS, automationActive, contextWindow, summaryWindow, type ResolvedSummary } from "../../../../core/summary/settings";
import type { BackfillMode } from "../../../../core/summary/prompts";

export { autoPatch, hidePatch, intervalPatch, methodPatch, optionOf } from "../../../../core/summary/couplings";

export const methodLabel = (o: BackfillMode): string => (o === "pair" ? "Every exchange" : o === "additive" ? "Timeline" : "Rolling recap");
/** What Backfill history says it will do this run. */
export const backfillLabel = (o: BackfillMode): string => (o === "pair" ? "Per-exchange" : o === "additive" ? "Rolling Additive" : "Rolling Replace");

/** What Summarize now says it will send (the estimate shown before it spends a call). */
export const nowLabel = (r: ResolvedSummary, hasText: boolean): string => {
  const window = summaryWindow(r);
  const reads = r.method === "pair" ? "the latest exchange" : window !== undefined ? `the last ${window} messages` : "every message";
  return `One call for ${reads}${r.method !== "pair" && hasText ? " and the saved summary" : ""}. The saved text stays if it fails.`;
};

export const timingLabel = (r: ResolvedSummary): string => (!automationActive(r) ? "Manual only" : r.method === "pair" ? "Every exchange" : `Every ${r.interval} messages`);

export function contextLabel(r: ResolvedSummary): string {
  const kept = contextWindow(r);
  return !r.include ? "Off" : r.hideOld && kept !== undefined ? `${kept} kept` : "Summary + chat";
}

/** A model id as the tile shows it: the last path part, cut to 24 characters. */
export function compactModelName(id: string): string {
  const short = id.split("/").pop() || id;
  return short.length > 24 ? `${short.slice(0, 21)}...` : short;
}

/** The variables the prompt template may use, which differ for Every exchange. */
export const promptVariables = (o: BackfillMode): string[] => (o === "pair" ? ["{{characterName}}", "{{userMessage}}", "{{aiMessage}}"] : ["{{characterName}}", "{{conversationHistory}}"]);

/** The sentence under "Summary Controls" (RoleCall `MemoryPanel.tsx:300-312`). */
export function controlsLine(r: ResolvedSummary): string {
  if (!automationActive(r)) return `Automatic summaries are off. Turn them on to summarize every ${SUMMARY_DEFAULTS.enabledInterval} messages; manual edits and Backfill history still work.`;
  return r.method === "pair" ? "One compact line is added after every user and AI exchange." : `The summary updates after every ${r.interval} persisted messages.`;
}

/** The hero's subtitle (RoleCall `MemoryPanel.tsx:17-29`); the Scenes list's cards do show the summary's preview, so RoleCall's "chat-card previews" is true here. */
export function heroSubtitle(r: ResolvedSummary, name: string): string {
  if (!automationActive(r)) return "Automatic summary generation is not currently running. You can still write or backfill the summary manually.";
  return r.method === "pair" ? `Auto-generated turn-by-turn summary of your story with ${name}. Powers chat-card previews + AI context.` : `Auto-generated summary of your story with ${name}. Runs at your exact configured interval and powers chat-card previews + AI context.`;
}


