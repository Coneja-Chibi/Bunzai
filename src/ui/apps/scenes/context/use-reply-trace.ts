/**
 * The Context wing's one read of a reply's trace (`ctx.api.getSceneTrace`): the take's newest reply, or the one the person paged to. Read again
 * when the scene's take or latest reply changes (as TrackHare's stage does), never on a timer. A reply that arrives while an older request is in
 * flight wins: a stale answer is dropped.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import type { AsyncState } from "../../../_shared/async-state";
import type { SceneTrace } from "../../../app-contract-scenes";
import type { Chat } from "../../../../stage/contracts/chat-store";

export type TraceState = AsyncState<{ trace: SceneTrace | null }>;

export function useReplyTrace(ctx: AppContext, chat: Chat): { state: TraceState; pick(messageId: string | undefined): void; reload(): void } {
  const [state, setState] = useState<TraceState>({ state: "loading" });
  const [messageId, setMessageId] = useState<string | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);
  // An answer that arrives after the wing is gone is dropped, as one from before the latest read is.
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setMessageId(undefined); }, [chat.id, chat.activeBranchId, chat.updatedAt]);
  useEffect(() => {
    const mine = ++latest.current;
    setState({ state: "loading" });
    ctx.api.getSceneTrace(chat.id, messageId).then(
      (trace) => { if (alive.current && mine === latest.current) setState({ state: "ready", trace }); },
      (e: unknown) => { if (alive.current && mine === latest.current) setState({ state: "failed", why: e instanceof Error && e.message ? e.message : "This turn could not be read." }); },
    );
  }, [ctx, chat.id, chat.activeBranchId, chat.updatedAt, messageId, tick]);
  const pick = useCallback((id: string | undefined) => setMessageId(id), []);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { state, pick, reload };
}
