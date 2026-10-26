/**
 * Casting another persona into the open scene: the one call and the one wording for its refusal, shared by the Cast wing's Casting Call and the Messenger's Swap persona so the two cannot drift.
 * The call changes this scene only (ChatStore rule 26) and is checked against the scene's snapshot version; the caller confirms first (cast-dialogs.tsx `CastConfirm`) and holds its own busy lock.
 */
import type { AppContext } from "../../../app-contract";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../../studio/scenes";
import { ApiHttpError } from "../../../_shared/api-fetch";
import { toErrorMessage } from "../../../_shared/error-message";

/** `to` null clears the role. */
export const castPersona = (api: AppContext["api"], chat: Pick<Chat, "id" | "snapshotVersion">, to: string | null): Promise<OpenScene> =>
  api.editScene("persona", { chatId: chat.id, personaId: to, expectedSnapshotVersion: chat.snapshotVersion });

/** What to tell the person when casting was refused: a scene changed elsewhere is said plainly, anything else in the server's own words. */
export function castProblem(e: unknown): string {
  const text = toErrorMessage(e, "that did not go through");
  return e instanceof ApiHttpError && e.status === 409 && !/reply is being written/i.test(text)
    ? "Could not switch: this scene changed in another window while you were choosing. Nothing was changed. Try again."
    : text;
}
