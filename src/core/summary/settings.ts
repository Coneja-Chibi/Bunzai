/**
 * The chat summary's settings as the readers see them (RoleCall `lib/summary/settings.ts`, rc-parity 08): the scene's sparse saved keys (ChatStore rule 45) laid over RoleCall's defaults, and the
 * three numbers derived from them. One module for the assembler, the automatic runs and the Memory tab, so they cannot disagree about what "on" or "the window" means. Pure.
 */
import type { ChatConnection, SummarySettings } from "../../stage/contracts/chat-store";

/** The pref (Settings, Memory & Summaries) that holds the person's default summary settings, copied onto each scene as it is started (studio/scenes.ts). */
export const DEFAULT_SUMMARY_PREF = "scenes.summaryDefaults";

/** RoleCall's `SUMMARY_SETTINGS_DEFAULTS`: `enabledInterval` is what switching automation on from interval 0 sets; `sourceLimit` is the characters kept of each source message when truncating. */
export const SUMMARY_DEFAULTS = Object.freeze({ interval: 0, enabledInterval: 60, keepRecent: 60, temperature: 0.3, maxTokens: 150, sourceLimit: 200 });

export interface ResolvedSummary {
  auto: boolean;
  interval: number;
  method: "rolling" | "pair";
  mode: "replace" | "additive";
  include: boolean;
  hideOld: boolean;
  window?: number;
  keepRecent?: number;
  temperature: number;
  maxTokens: number;
  truncate: boolean;
  reasoning: boolean;
  model?: ChatConnection;
  prompt?: string;
}

export function resolveSummary(saved: SummarySettings | undefined): ResolvedSummary {
  return {
    auto: saved?.auto ?? false,
    interval: saved?.interval ?? SUMMARY_DEFAULTS.interval,
    method: saved?.method ?? "rolling",
    mode: saved?.mode ?? "replace",
    include: saved?.include ?? true,
    hideOld: saved?.hideOld ?? false,
    ...(saved?.window !== undefined ? { window: saved.window } : {}),
    ...(saved?.keepRecent !== undefined ? { keepRecent: saved.keepRecent } : {}),
    temperature: saved?.temperature ?? SUMMARY_DEFAULTS.temperature,
    maxTokens: saved?.maxTokens ?? SUMMARY_DEFAULTS.maxTokens,
    truncate: saved?.truncate ?? false,
    reasoning: saved?.reasoning ?? false,
    ...(saved?.model ? { model: saved.model } : {}),
    ...(saved?.prompt ? { prompt: saved.prompt } : {}),
  };
}

/** Automatic summaries run only when switched on and there is something to count by: a per-exchange summary, or an interval above zero (RoleCall `normalizeStoredSummarySettings`: a contradictory record fails closed). */
export const automationActive = (r: ResolvedSummary): boolean => r.auto && (r.method === "pair" || r.interval > 0);

/** Messages included in each rolling summary: the setting, else the interval, else all of them (undefined). */
export const summaryWindow = (r: ResolvedSummary): number | undefined => r.window ?? (r.interval > 0 ? r.interval : undefined);

/** The newest messages kept verbatim beside a summary: Keep recent, else the summary window (RoleCall `resolveSummaryContextWindowSize`). */
export const contextWindow = (r: ResolvedSummary): number | undefined => r.keepRecent ?? summaryWindow(r);
