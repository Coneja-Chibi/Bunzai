/**
 * Loads the one pack a scene's backdrop names, through the pack's own light read (the same one the pack editor
 * opens), and says plainly when it is gone: a missing pack is the scene's "backdrop is gone" state, never an error.
 * `reload` re-reads after the picker added images.
 */
import { useCallback, useEffect, useState } from "react";
import type { AppContext } from "../../app-contract";
import { apiStatusIs } from "../../_shared/api-fetch";
import { backdropPack, type BackdropPack } from "./scene-backdrop-core";

export type BackdropPackState = { state: "none" } | { state: "loading" } | { state: "gone" } | { state: "failed" } | { state: "ready"; pack: BackdropPack };

export function useBackdropPack(ctx: AppContext, packId: string | undefined): BackdropPackState & { reload(): void } {
  const [result, setResult] = useState<{ id: string; value: BackdropPackState } | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    if (!packId) return;
    let live = true;
    ctx.api.getLightEditableEntity(`kind=pack&id=${encodeURIComponent(packId)}`).then(
      (loaded) => {
        const pack = backdropPack(loaded.entity);
        if (live) setResult({ id: packId, value: pack ? { state: "ready", pack } : { state: "gone" } });
      },
      (error: unknown) => { if (live) setResult({ id: packId, value: apiStatusIs(error, 404) ? { state: "gone" } : { state: "failed" } }); },
    );
    return () => { live = false; };
  }, [ctx, packId, tick]);
  if (!packId) return { state: "none", reload };
  return { ...(result?.id === packId ? result.value : { state: "loading" as const }), reload };
}
