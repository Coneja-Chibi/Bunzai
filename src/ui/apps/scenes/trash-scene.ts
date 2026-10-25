/** Moves a scene whose character is gone to the Trash (soft delete), then leaves the page; a refusal is said, not swallowed. */
import type { AppContext } from "../../app-contract";
import { toErrorMessage } from "../../_shared/error-message";

export function trashScene({ api, setStatus }: Pick<AppContext, "api" | "setStatus">, chatId: string, leave: () => void): void {
  api.deleteScene(chatId).then(() => { setStatus("Moved to the Trash."); leave(); }, (e: unknown) => setStatus(`could not move to the Trash: ${toErrorMessage(e)}`));
}
