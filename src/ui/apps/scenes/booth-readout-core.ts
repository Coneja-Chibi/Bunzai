/**
 * The Control Booth readout's average reply time. RoleCall shows a constant 1.2s there (QuickPlayPanel.tsx:773-777,
 * a TODO); Bunzai stores how long each version took (a swipe's generation.generationMs), so the average is
 * the mean over the last replies actually timed. Nothing timed is null, shown as a dash. Pure.
 */
import type { Message } from "../../../stage/contracts/chat-store";
import type { SceneTrace } from "../../app-contract-scenes";
import { selectedSwipe } from "./use-scene-swipe-preview";

export const READOUT_REPLIES = 20;

/** The mean generationMs of the last 20 replies that carry one, or null when none does. */
export function averageReplyMs(messages: readonly Message[]): number | null {
  const timed: number[] = [];
  for (let i = messages.length - 1; i >= 0 && timed.length < READOUT_REPLIES; i--) {
    const m = messages[i]!;
    const ms = m.role === "assistant" && !m.cut ? selectedSwipe(m)?.generation?.generationMs : undefined;
    if (ms) timed.push(ms);
  }
  return timed.length === 0 ? null : timed.reduce((a, b) => a + b, 0) / timed.length;
}

/** What the last reply's request weighed: the provider's own sent count when it reported one, else the assembler's own total (an estimate); null before any reply. RoleCall shows its context usage here. */
export function requestTokens(trace: SceneTrace | null): { tokens: number; exact: boolean } | null {
  if (!trace) return null;
  if (trace.turn?.exact && trace.turn.sent !== undefined) return { tokens: trace.turn.sent, exact: true };
  return { tokens: trace.blocks.reduce((n, b) => n + b.tokens, 0), exact: false };
}

/** RoleCall's cut for the readout (QuickPlayPanel.tsx:1633): thousands with one decimal and a k, small numbers as they are. */
export const formatTokens = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
