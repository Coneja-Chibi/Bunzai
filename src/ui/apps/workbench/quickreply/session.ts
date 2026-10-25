/** Pure editing operations for one quick-reply set. */
import type { QuickReply, QuickReplyBody } from "../../../../entities/quickreply/schema";
import { newUiId } from "../../../_shared/new-id";
import { isRecord } from "../../../../core/guards";
import type { EditorTouch, OccurrenceIndex } from "../../../_shared/editor-state";
import { deepEq } from "../editor-core";

export const addReply = (body: QuickReplyBody): QuickReplyBody => ({
  ...body,
  replies: [...body.replies, {
    id: newUiId("reply_"),
    label: "",
    message: "",
  }],
});

export const patchReply = (
  body: QuickReplyBody,
  id: string,
  patch: Partial<Pick<QuickReply, "label" | "message" | "title" | "hidden">>,
): QuickReplyBody => ({
  ...body,
  replies: body.replies.map((reply) => reply.id === id ? { ...reply, ...patch } : reply),
});

export const removeReply = (body: QuickReplyBody, id: string): QuickReplyBody => ({
  ...body,
  replies: body.replies.filter((reply) => reply.id !== id),
});

export const quickReplyDirty = (body: QuickReplyBody, baseline: QuickReplyBody): boolean =>
  !deepEq(body, baseline);

/** Read a canonical quick-reply set out of the loaded entity, tolerant of a missing or partial body. */
export function bodyFromEntity(entity: unknown): QuickReplyBody {
  const body = isRecord(entity) && isRecord(entity.body) ? entity.body : null;
  if (body && typeof body.name === "string" && Array.isArray(body.replies)) {
    return structuredClone(body) as unknown as QuickReplyBody;
  }
  return { name: "Untitled quick replies", replies: [] };
}

/** An edit touch that reads and writes only the reply `id` (every occurrence of it) in the body. */
export const replyTouch = (id: string, index: OccurrenceIndex<QuickReply>): EditorTouch<QuickReplyBody> => ({
  key: `reply:${id}`,
  read: (body) => index.positions(id).map((at) => body.replies[at]).filter((reply) => Boolean(reply)),
  write: (body, value) => {
    const replies = value as QuickReplyBody["replies"];
    const next = [...body.replies];
    index.positions(id).forEach((at, occurrence) => { if (replies[occurrence]) next[at] = replies[occurrence]!; });
    return { ...body, replies: next };
  },
});
