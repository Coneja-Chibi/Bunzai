/**
 * The Story Director's background tracker round (or the person's Undo of one of its updates) finished for THIS scene: the app-wide studio-events stream pushed `scene-trackers` (plan 16),
 * the piece store kept it, and the page reads the scene again and tells the Director panel to read its state again. The turn's own stream has closed by then, so this is the only way the
 * "Updated by the Story Director" line appears without a reload.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { PieceStore } from "../../_shared/piece-store";
import { noteDirectorChanged } from "./props/story-director/director-live";

export function useTrackersHeard(pieces: PieceStore, chatId: string, reload: () => void): void {
  const heard = useSyncExternalStore((listener) => pieces.subscribeList(listener), () => pieces.streamState().sceneTrackers, () => null);
  useEffect(() => {
    if (!heard || heard.chatId !== chatId) return;
    noteDirectorChanged(chatId);
    reload();
  }, [heard, chatId, reload]);
}
