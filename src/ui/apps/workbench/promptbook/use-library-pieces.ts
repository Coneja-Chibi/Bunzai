/** Authoring pickers subscribe to the canonical piece list so creations, renames and deletions remain visible. */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { AppContext } from "../../../app-contract";
import { toErrorMessage } from "../../../_shared/error-message";
export function useLibraryPieces(ctx: AppContext) {
  const subscribe = useCallback((listener: () => void) => ctx.pieces.subscribeList(listener), [ctx.pieces]);
  const snapshot = useCallback(() => ctx.pieces.listSnapshot(), [ctx.pieces]);
  const pieces = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void ctx.pieces.loadInitial(() => ctx.api.listEntities(), (rows) => rows).catch((e: unknown) => { if (live) setError(toErrorMessage(e, "Could not read Library pieces.")); });
    return () => { live = false; };
  }, [ctx.api, ctx.pieces]);
  return { pieces, error };
}
