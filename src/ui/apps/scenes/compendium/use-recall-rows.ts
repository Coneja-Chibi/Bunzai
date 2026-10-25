/**
 * The Activity feed's PRE and LIVE cards: what the Compendium's recall retrieved for the scene's latest replies, and what the narrator looked up
 * while writing them, read from each reply's stored trace (getSceneTrace, the route TrackHare reads), so nothing here needs the receipt store. It reads the newest RECALL_REPLIES
 * replies, again whenever the scene's take or latest reply changes, and says so when a read fails instead of showing none.
 */
import { useEffect, useRef, useState } from "react";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../app-contract";
import { toErrorMessage } from "../../../_shared/error-message";
import { liveRows, recallRows, type ActivityRow } from "./activity-core";

export const RECALL_REPLIES = 5;

export function useRecallRows(ctx: AppContext, chat: Chat): { rows: ActivityRow[]; why?: string } {
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const [got, setGot] = useState<{ rows: ActivityRow[]; why?: string }>({ rows: [] });
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const first = await api.current.getSceneTrace(chat.id);
        const rest = first ? await Promise.all(first.replies.slice(1, RECALL_REPLIES).map((r) => api.current.getSceneTrace(chat.id, r.messageId))) : [];
        if (live) setGot({ rows: [first, ...rest].flatMap((t) => [...recallRows(t), ...liveRows(t)]) });
      } catch (e) {
        if (live) setGot({ rows: [], why: toErrorMessage(e, "the recall activity could not be read") });
      }
    })();
    return () => { live = false; };
  }, [chat.id, chat.updatedAt, chat.activeBranchId]);
  return got;
}
