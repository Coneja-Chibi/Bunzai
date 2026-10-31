/** Keep complete chat requests, including journal reads and projections, alive through shutdown. */
import type { StudioStoreLike } from "../studio/contracts";
import { libraryChatsFor } from "../studio/library-content";
import { StudioLockedError } from "../studio/errors";
import { runOwnedTask } from "../studio/scene-turn-runtime";
import { sceneRuntimeFor } from "./server-scene-runtime";
import { studioErr } from "./server-security";

export async function ownChatRequest(store: StudioStoreLike, run: () => Promise<Response>): Promise<Response> {
  try {
    const chats = libraryChatsFor(store.studioPath());
    if (!chats) throw new StudioLockedError();
    return await runOwnedTask(sceneRuntimeFor(chats), run);
  } catch (error) { return studioErr(error); }
}
