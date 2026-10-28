/**
 * `GET /api/chats/tracker-changes?branchId=&from=&to=` (the Messenger's change visuals): what each live message from `from` through `to` (the tip when left out) changed in
 * the library trackers on the version it shows, with each tracker's name, change style and icons (studio/tracker-changes.ts). A read only. A branch or message that is not
 * there is a 404; an empty range is an empty list.
 */
import type { ChatStore } from "../stage/contracts/chat-store";
import type { ReadTracker } from "../studio/library-trackers";
import { trackerChangesBetween } from "../studio/tracker-changes";
import { err, json } from "./server-security";

/** The shape of an id in a query: letters, digits, underscores and hyphens. */
const ID = /^[\w-]+$/;

export async function handleTrackerChangesRoute(url: URL, chats: ChatStore, read: ReadTracker | undefined): Promise<Response> {
  const branchId = url.searchParams.get("branchId") ?? "";
  const from = url.searchParams.get("from") ?? "";
  if (!ID.test(branchId) || !ID.test(from)) return err("expected branchId and from, each an id", 400);
  // An empty `to` means the tip; an id that is not a message of the take is a 404 like any absent message, and one that is not even well formed is a 400.
  const to = url.searchParams.get("to") || undefined;
  if (to !== undefined && !ID.test(to)) return err("to is not a message id", 400);
  const messages = await trackerChangesBetween(chats, read, branchId, from, to);
  return messages ? json({ messages }) : err("that range is gone", 404);
}
