/**
 * The packs the Music tab plays from: every pack in the library, read through the pack's own light read (the backdrop picker's way),
 * kept as the packs that hold sound files (`groups`) and the whole list (`packs`, so a first track can go into a pack that has none yet).
 * `reload` re-reads after an add, a rename or a removal. A pack that cannot be read is left out, never an error for the rest.
 */
import { useCallback, useEffect, useState } from "react";
import type { AppContext } from "../../app-contract";
import { backdropPack } from "./scene-backdrop-core";
import { groupOf, type TrackGroup } from "./stage-music-core";

export interface MusicLibrary { state: "loading" | "ready"; packs: { id: string; name: string }[]; groups: TrackGroup[]; reload(): void }

export function useMusicLibrary(ctx: AppContext): MusicLibrary {
  const [loaded, setLoaded] = useState<Pick<MusicLibrary, "packs" | "groups"> | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    void (async () => {
      const listed = await ctx.api.listEntities("pack").catch(() => []);
      const read = await Promise.all(listed.map((p) => ctx.api.getLightEditableEntity(`kind=pack&id=${encodeURIComponent(p.id)}`).then((l) => backdropPack(l.entity), () => null)));
      if (!live) return;
      const packs = read.flatMap((p) => (p ? [p] : []));
      setLoaded({ packs: packs.map((p) => ({ id: p.id, name: p.name })), groups: packs.flatMap((p) => groupOf(p) ?? []) });
    })();
    return () => { live = false; };
  }, [ctx, tick]);
  return { state: loaded ? "ready" : "loading", packs: loaded?.packs ?? [], groups: loaded?.groups ?? [], reload };
}
