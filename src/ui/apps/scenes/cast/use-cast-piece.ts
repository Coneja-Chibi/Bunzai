/**
 * Reads the Library piece a Cast wing tab edits (the scene's character or persona), with its revision and
 * listing summary. A piece the Library no longer holds reads as "gone" (the scene keeps its own copy), and
 * a failed read says why. Reading again after the scene moved onto a newer version is `reload`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { ApiHttpError } from "../../../_shared/api-fetch";
import { toErrorMessage } from "../../../_shared/error-message";

export type CastPiece =
  | { state: "none" }
  | { state: "loading" }
  | { state: "gone" }
  | { state: "failed"; why: string }
  | { state: "ready"; entity: unknown; revision: string; summary: StudioEntitySummary | undefined };

export function useCastPiece(ctx: AppContext, kind: "character" | "persona", id: string | null): { piece: CastPiece; reload(): void } {
  const [piece, setPiece] = useState<CastPiece>(id ? { state: "loading" } : { state: "none" });
  const [round, setRound] = useState(0);
  // The shell rebuilds ctx on every status change; the wing must not reload with it.
  const api = useRef(ctx.api);
  api.current = ctx.api;
  useEffect(() => {
    if (!id) return setPiece({ state: "none" });
    let live = true;
    setPiece({ state: "loading" });
    Promise.all([
      api.current.getEditableEntity(`kind=${kind}&id=${encodeURIComponent(id)}`),
      api.current.getEntitySummary(kind, id).catch(() => null),
    ]).then(([found, summary]) => {
      if (live) setPiece({ state: "ready", entity: found.entity, revision: found.revision, summary: summary ?? undefined });
    }, (e: unknown) => {
      if (live) setPiece(e instanceof ApiHttpError && e.status === 404 ? { state: "gone" } : { state: "failed", why: toErrorMessage(e, `the ${kind} could not be read`) });
    });
    return () => { live = false; };
  }, [kind, id, round]);
  return { piece, reload: useCallback(() => setRound((n) => n + 1), []) };
}
