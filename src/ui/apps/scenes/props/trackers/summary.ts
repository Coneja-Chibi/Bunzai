/**
 * The one-line summary on a tracker's card (Messenger's Trackers list) and under its frame's title. Each module owns its own pure `summaryLine(data, context)` next to its panel, read from the stored
 * `data` through the module's own reader (so missing or invalid state reads as the module's defaults); it returns a short honest line, or "" when there is nothing worth saying yet. A module's Prop
 * registers its line here by module id (`trackerProp`, the Storyboards), so no caller keeps a switch over modules.
 */
import type { TrackerContext, TrackerModule } from "../../../../../stage/contracts/chat-store";

export type SummaryLine = (data: unknown, context?: TrackerContext) => string;

const lines = new Map<TrackerModule, SummaryLine>();

export function registerSummary(module: TrackerModule, line: SummaryLine): void { lines.set(module, line); }

/** The line for a module's data and AI Context choice ("" when the module has none to give or was not registered). */
export function trackerSummary(module: TrackerModule, data: unknown, context?: TrackerContext): string {
  return lines.get(module)?.(data, context) ?? "";
}

/** "1 item", "3 items". */
export const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
