/**
 * The Control Booth's read of the scene's library preset: its name for the status tile, its token
 * count and the preset's own sampler values for the sliders. The Booth never edits preset text, so this
 * only reads; the Prompting wing (scene-preset-wing.tsx) is where text is saved. A preset the library no
 * longer holds is its own state, not a blank name.
 */
import { useEffect, useRef, useState } from "react";
import type { AppContext } from "../../app-contract";
import type { PresetBody } from "../../../entities/preset/schema";
import { ApiHttpError } from "../../_shared/api-fetch";
import type { AsyncState } from "../../_shared/async-state";
import { toErrorMessage } from "../../_shared/error-message";

export type BoothPreset = AsyncState<{ body: PresetBody }, { state: "none" } | { state: "gone" }>;

export function useBoothPreset(ctx: AppContext, presetId: string | null): BoothPreset {
  const [loaded, setLoaded] = useState<BoothPreset>(presetId ? { state: "loading" } : { state: "none" });
  // The shell rebuilds ctx on every status change; the ref keeps the read from repeating with it.
  const api = useRef(ctx.api);
  api.current = ctx.api;
  useEffect(() => {
    if (!presetId) return setLoaded({ state: "none" });
    let live = true;
    setLoaded({ state: "loading" });
    api.current.getEditableEntity(`kind=preset&id=${encodeURIComponent(presetId)}`).then((found) => {
      if (!live) return;
      const entity = found.entity as { kind?: string; body: PresetBody };
      setLoaded(entity?.kind === "preset" ? { state: "ready", body: entity.body } : { state: "gone" });
    }, (e: unknown) => {
      if (live) setLoaded(e instanceof ApiHttpError && e.status === 404 ? { state: "gone" } : { state: "failed", why: toErrorMessage(e, "the preset could not be read") });
    });
    return () => { live = false; };
  }, [presetId]);
  return loaded;
}
