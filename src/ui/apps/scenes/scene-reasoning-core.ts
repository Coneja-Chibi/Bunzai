/**
 * The scene's reasoning blocks, the logic once (approved wireframe rc-port/scene-reasoning.html): what a
 * reply's two kinds of thinking are (the provider's native channel, then thinking written inside the reply
 * text's own tags), their labels and times, when a block is open, and the open or closed choice a person
 * made, which lives for the session only. The variants of the scene.reasoning surface (variants/scene.reasoning)
 * and the blocks (scene-reasoning-blocks.tsx) differ in markup and style, never in what this decides.
 */
import { splitReasoning, tagThinkingState, type ReasoningFormat } from "../../../core/reasoning-tags";
import type { Generation } from "../../../stage/contracts/chat-store";
import { formatGenTime } from "./scene-meta-core";

export type ReasoningKind = "native" | "tags";

export const AUTO_OPEN_KEY = "scenes.autoOpenReasoning";
export const CAP_LONG_KEY = "scenes.capLongReasoning";
/** RoleCall's auto-expand: on unless the person turned it off. */
export const autoOpenReasoning = (pref: unknown): boolean => pref !== false;
/** Bunzai's own opt-in cap (300px, scrolling inside): off unless the person turned it on. */
export const capLongReasoning = (pref: unknown): boolean => pref === true;

/** What a bubble draws its blocks from: plain strings, numbers and booleans only, so a finished bubble's props stay stable and its memo holds. */
export interface ReasoningProps {
  /** The segment the open choices are kept under: the saved version's id, or the live turn's. */
  rKey?: string;
  rNat?: string;
  rNatMs?: number;
  rTag?: string;
  rTagMs?: number;
  /** The reply is still being written. */
  rLive?: boolean;
  /** The block that is thinking right now (dots and a caret). */
  rDots?: ReasoningKind;
  rAuto?: boolean;
  rCap?: boolean;
}

interface Source {
  /** The segment key (see ReasoningProps.rKey). */
  key: string;
  /** The saved version's text as stored; unused while live. */
  content: string | undefined;
  gen: Generation | undefined;
  format: ReasoningFormat | undefined;
  /** The turn being written, when this bubble is it. */
  live: { text: string; reasoning: string; prefill?: string } | null;
  /** Show Prefill in Chat: the Start Reply With text the reply was written after goes back in front of it. */
  showPrefill?: boolean;
  prefs: { get(key: string): unknown };
}

/** The blocks' facts for one bubble, and for a live one the reply text with the thinking cut out. */
export function reasoningOf({ key, content, gen: stored, format, live, prefs, showPrefill }: Source): { props: ReasoningProps; reply: string } {
  // A turn being written has no stored times yet (the version showing under it is an older one).
  const gen = live ? undefined : stored;
  const head = showPrefill ? (live ? live.prefill : stored?.prefill) ?? "" : "";
  const text = head + (live ? live.text : content ?? "");
  // Catch thinking reads more than tags (a closer alone, a heading, a stored Smart Recovery boundary), so every reply is read.
  const read = gen?.thinkingEnd ? { ...(format ?? { prefix: "", suffix: "", separator: "" }), recoveredEnd: gen.thinkingEnd } : format;
  const split = splitReasoning(text, read, live !== null);
  const nat = (live ? live.reasoning : gen?.reasoning?.text ?? "").trim();
  const dots = live && nat && !text ? "native" : live && tagThinkingState(text, format) === "open" ? "tags" : undefined;
  const props: ReasoningProps = nat || split.thinking
    ? {
        rKey: key,
        ...(nat ? { rNat: nat, ...(gen?.reasoningMs ? { rNatMs: gen.reasoningMs } : {}) } : {}),
        ...(split.thinking ? { rTag: split.thinking, ...(gen?.tagThinkingMs ? { rTagMs: gen.tagThinkingMs } : {}) } : {}),
        rLive: live !== null,
        ...(dots ? { rDots: dots } : {}),
        rAuto: autoOpenReasoning(prefs.get(AUTO_OPEN_KEY)),
        rCap: capLongReasoning(prefs.get(CAP_LONG_KEY)),
      }
    : {};
  // A reply with nothing taken out is shown exactly as written (the split trims its ends).
  return { props, reply: split.thinking === "" && split.reply === text.trim() ? text : split.reply };
}

/** The duration slot: the stored time, none for an import (never a guessed number), or the live words. */
export function durationLabel(kind: ReasoningKind, ms: number | undefined, live: boolean): string {
  if (live) return kind === "native" ? "Reasoning" : "Thinking";
  if (kind === "native") return ms ? `Reasoned for ${formatGenTime(ms)}` : "Native reasoning";
  return ms ? `Thought for ${formatGenTime(ms)}` : "Thought";
}

/** What a collapsed block shows of its text: the start, flattened, cut at 60 characters. */
export function snippetOf(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 60 ? `${flat.slice(0, 60).trimEnd()}...` : flat;
}

/** The open or closed choices made by hand this session, per segment and kind. Not saved. */
const chosen = new Map<string, boolean>();
const CHOICES_KEPT = 500;
const slot = (key: string, kind: ReasoningKind): string => `${key}|${kind}`;

export function chooseOpen(key: string, kind: ReasoningKind, open: boolean): void {
  chosen.set(slot(key, kind), open);
  if (chosen.size > CHOICES_KEPT) chosen.delete(chosen.keys().next().value!);
}

/** The live turn became the saved version: its choices follow it, so a block closed by hand does not reopen. */
export function carryOpenChoices(from: string, to: string): void {
  for (const kind of ["native", "tags"] as const) {
    const choice = chosen.get(slot(from, kind));
    if (choice !== undefined) chooseOpen(to, kind, choice);
  }
}

export const forgetOpenChoices = (): void => chosen.clear();

/** Closed unless chosen by hand. Native reasoning opens by itself while the reply streams (the setting), and a reply that is only thinking opens its blocks. */
export function isOpen(a: { key: string; kind: ReasoningKind; live: boolean; auto: boolean; only: boolean }): boolean {
  return chosen.get(slot(a.key, a.kind)) ?? (a.only || (a.kind === "native" && a.live && a.auto));
}
