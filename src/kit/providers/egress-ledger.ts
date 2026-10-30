/**
 * Bounded model-usage accounting for /privacy. Usage frames provide provider names and token counts;
 * connection checks, external tools, failed requests without usage, and other network traffic are
 * outside this ledger. Timestamps come from callers; totals include entries evicted from the window.
 */
import { compactCount } from "../_shared/compact-count";
import { numOr } from "../../core/guards";
import { cleanCount } from "./usage";

/** One send: the provider it reached and the tokens it carried. `at` is epoch ms, stamped by the shell. */
export interface EgressEntry {
  readonly at: number;
  readonly provider: string;
  readonly input: number;
  readonly output: number;
}

/** The session's sends: the most recent entries (capped) plus cumulative token totals for the session. */
export interface EgressLedger {
  readonly entries: readonly EgressEntry[];
  readonly totalInput: number;
  readonly totalOutput: number;
  readonly sends: number;
}

export const EMPTY_LEDGER: EgressLedger = { entries: [], totalInput: 0, totalOutput: 0, sends: 0 };

/** Keep the most recent sends for display; a long session can make many calls. Totals stay cumulative. */
const MAX_ENTRIES = 500;

/**
 * Record one send, immutably and bounded. The entry window is capped to the most recent sends; the
 * totals and the send count are cumulative across the whole session, so they never undercount after an
 * old entry rolls off the window. A ragged provider name is coerced to a readable placeholder.
 */
export const recordEgress = (ledger: EgressLedger, entry: EgressEntry): EgressLedger => {
  const clean: EgressEntry = {
    at: numOr(entry.at, 0),
    provider: typeof entry.provider === "string" && entry.provider.length > 0 ? entry.provider : "provider",
    input: cleanCount(entry.input),
    output: cleanCount(entry.output),
  };
  return {
    entries: [...ledger.entries, clean].slice(-MAX_ENTRIES),
    totalInput: ledger.totalInput + clean.input,
    totalOutput: ledger.totalOutput + clean.output,
    sends: ledger.sends + 1,
  };
};

/** Compact a token count for display: 840 -> "840", 3100 -> "3.1k", 1_200_000 -> "1.2M". */
const compact = (n: number): string => compactCount(n, [
  { threshold: 1000, divisor: 1000, suffix: "k" },
  { threshold: 1_000_000, divisor: 1_000_000, suffix: "M" },
], 1, String(Math.round(n)));

/** HH:MM (24h, local) for a send's timestamp; a zero or unknown stamp reads "--:--". */
const clockOf = (at: number): string => {
  if (!Number.isFinite(at) || at <= 0) return "--:--";
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Render recorded model usage as the /privacy readout. Markdown,
 *  so the shell renders it as a normal reply. Pure but for local-time formatting of each stamp. */
export const formatLedger = (ledger: EgressLedger): string => {
  if (ledger.sends === 0) {
    return "**Recorded model usage**\n\nNo model usage recorded this session. This is not a network activity log: connection checks and external tools can also make requests.";
  }
  const plural = ledger.sends === 1 ? "" : "s";
  const head = `**Recorded model usage**\n\n${ledger.sends} recorded call${plural} · ${compact(ledger.totalInput)} in / ${compact(ledger.totalOutput)} out total\n`;
  const rows = ledger.entries.map(
    (e) => `- \`${clockOf(e.at)}\`  ${e.provider}  ${compact(e.input)} in / ${compact(e.output)} out`,
  );
  return [
    head,
    ...rows,
    "\nThis is not a network activity log. Configured API keys are used for authentication; avoid putting secrets in messages or tool arguments.",
  ].join("\n");
};
