/**
 * What the Messenger adds around each message of the page's own transcript (backlog slices 6 and 7): the run, badge and reply props for the Bubble, and the day and New messages dividers that
 * lead it. `model.ts` does the reading; this places it. Off (Full Chat) it is an empty map, so every message draws exactly as before. The New messages line sits where the scene stood when this
 * page opened (the read mark of `shell/read-marks.ts` as it was before this open moved it), so it stays put while the person reads.
 */
import { useMemo, useRef, type JSX } from "react";
import type { Message } from "../../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../../app-contract";
import type { BubbleProps } from "../../scene-bubble";
import type { Row } from "../../scene-page-types";
import { selectedSwipe } from "../../use-scene-swipe-preview";
import { readMarks } from "../shell/read-marks";
import { transcriptDecor } from "./model";

export type MessageDecor = { props: Pick<BubbleProps, "grouped" | "runMore" | "clock" | "badge" | "replyWho" | "replyText">; lead: JSX.Element | null };
const NONE: ReadonlyMap<string, MessageDecor> = new Map();

/** Who wrote a message: the persona it was written under (or the current one), or the character. */
export const authorOf = (m: Message, personaName: string, characterName: string): string =>
  m.role === "user" ? (m.persona === undefined ? personaName || "You" : m.persona?.name || "You") : characterName;

export function Dividers({ day, fresh }: { day: string | undefined; fresh: boolean }): JSX.Element | null {
  if (!day && !fresh) return null;
  return (
    <>
      {day && <div className="datesep" role="separator" aria-label={day} data-part="scene.messenger.transcript.day"><span>{day}</span></div>}
      {fresh && <div className="datesep fresh" role="separator" aria-label="New messages" data-part="scene.messenger.transcript.new"><span>New messages</span></div>}
    </>
  );
}

/** The message count the scene had when it was last read, taken once per scene before the Messenger moves the mark. */
function useOpenedCount(prefs: AppContext["prefs"], chatId: string, on: boolean): number | undefined {
  const held = useRef<{ chatId: string; count: number | undefined } | null>(null);
  if (on && held.current?.chatId !== chatId) held.current = { chatId, count: readMarks(prefs)[chatId]?.count };
  return on ? held.current?.count : undefined;
}

export interface DecorArgs {
  on: boolean;
  rows: readonly Row[];
  prefs: AppContext["prefs"];
  chatId: string;
  personaName: string;
  characterName: string;
  /** message texts as drawn: macros expanded, then scene regex */
  shown: ReadonlyMap<string, string>;
  regexed: ReadonlyMap<string, string>;
}

export function useTranscriptDecor(a: DecorArgs): ReadonlyMap<string, MessageDecor> {
  const readCount = useOpenedCount(a.prefs, a.chatId, a.on);
  return useMemo(() => {
    if (!a.on) return NONE;
    const decor = transcriptDecor(a.rows, {
      whoOf: (m) => authorOf(m, a.personaName, a.characterName),
      textOf: (m) => a.regexed.get(m.id) ?? a.shown.get(m.id) ?? selectedSwipe(m)?.content ?? "",
      readCount,
    });
    const out = new Map<string, MessageDecor>();
    for (const [id, d] of decor) {
      out.set(id, {
        props: { grouped: d.grouped, runMore: d.runMore, clock: d.clock, badge: d.badge, ...(d.replyWho ? { replyWho: d.replyWho, replyText: d.replyText } : {}) },
        lead: d.day || d.fresh ? <Dividers day={d.day} fresh={d.fresh} /> : null,
      });
    }
    return out;
  }, [a.on, a.rows, a.personaName, a.characterName, a.shown, a.regexed, readCount]);
}
