/**
 * The Messenger transcript's reading of the page rows (backlog slices 6 and 7): which messages continue a run by the same speaker, which one starts a new day, which one begins the unread stretch, what
 * the role badge says, and which message a reply follows. Pure and derived: no stored field (`Message` has no reply-to, so the "reply" is only the user message just before an AI reply, and the copy
 * says so). A run never crosses a cut line, a persona-swap line, a day change or the New messages divider.
 */
import type { Message } from "../../../../../stage/contracts/chat-store";
import { validMs } from "../../scene-meta-core";
import type { Row } from "../../scene-page-types";

export interface Decor {
  /** continues the run above: no avatar and name, the time on hover in the gutter */
  grouped: boolean;
  /** another message of this run follows: its meta line stays quiet (the run's last message carries it) */
  runMore: boolean;
  /** the message's own time of day, for the gutter */
  clock: string;
  badge: "Persona" | "Character";
  /** a day divider goes above this message */
  day?: string;
  /** the New messages divider goes above this message */
  fresh: boolean;
  /** an AI reply that follows a user message: who wrote it and how it starts */
  replyWho?: string;
  replyText?: string;
}

export interface DecorInput {
  whoOf(m: Message): string;
  /** the message as drawn (after scene regex), used for the quote */
  textOf(m: Message): string;
  /** the message count of the take when the scene was last read; the divider sits above message number `readCount + 1` */
  readCount?: number | undefined;
}

export const dayKey = (ms: number): string => new Date(ms).toDateString();
/** The divider text: weekday, month, day and year ("Sunday, Oct 4, 2026"), in the reader's locale unless one is given. */
export const dayLabel = (ms: number, locale: Intl.LocalesArgument = []): string => (validMs(ms) ? new Date(ms).toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric", year: "numeric" }) : "");
export const clockOf = (ms: number): string => (validMs(ms) ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

const QUOTE_MAX = 90;
export function quoteOf(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > QUOTE_MAX ? `${flat.slice(0, QUOTE_MAX).trimEnd()}...` : flat;
}

export function transcriptDecor(rows: readonly Row[], input: DecorInput): Map<string, Decor> {
  const out = new Map<string, Decor>();
  let prev: { m: Message; who: string } | null = null; // the message row directly above, null after a cut or swap line
  let lastMsg: { m: Message; who: string } | null = null; // the nearest message above, whatever lies between
  let lastDay: string | null = null;
  for (const row of rows) {
    if (row.kind !== "msg") { prev = null; continue; }
    const { m, n } = row;
    const who = input.whoOf(m);
    const at = validMs(m.createdAt) ? m.createdAt : undefined;
    const key = at === undefined ? null : dayKey(at);
    const newDay = key !== null && key !== lastDay;
    const fresh = input.readCount !== undefined && n > 1 && n === input.readCount + 1;
    const grouped = prev !== null && !newDay && !fresh && prev.m.role === m.role && prev.who === who;
    const decor: Decor = { grouped, runMore: false, clock: at === undefined ? "" : clockOf(at), badge: m.role === "user" ? "Persona" : "Character", fresh };
    if (newDay && at !== undefined) decor.day = dayLabel(at);
    if (m.role === "assistant" && !grouped && lastMsg?.m.role === "user") {
      const quote = quoteOf(input.textOf(lastMsg.m));
      if (quote) { decor.replyWho = lastMsg.who; decor.replyText = quote; }
    }
    if (grouped) out.get(prev!.m.id)!.runMore = true;
    out.set(m.id, decor);
    prev = lastMsg = { m, who };
    if (key !== null) lastDay = key;
  }
  return out;
}
