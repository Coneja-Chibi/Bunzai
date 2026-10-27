/**
 * The Control Booth's read of the scene's writing setup: its name for the status tile, its token count and its own
 * sampler values for the sliders, read as the preset it sends (core/writing.ts), so a Script Sheet reads the same way.
 * The Booth never edits it; the Prompting wing (scene-preset-wing.tsx) is where it is saved. One the library no
 * longer holds is its own state, not a blank name.
 */
import { useEffect, useRef, useState } from "react";
import type { AppContext } from "../../app-contract";
import type { PresetBody } from "../../../entities/preset/schema";
import { asPresetBody } from "../../../core/writing";
import { ApiHttpError } from "../../_shared/api-fetch";
import type { AsyncState } from "../../_shared/async-state";
import { toErrorMessage } from "../../_shared/error-message";

export type BoothPreset = AsyncState<{ body: PresetBody }, { state: "none" } | { state: "gone" }>;

export function useBoothPreset(ctx: AppContext, slot: { kind: string; id: string } | null): BoothPreset {
  const [loaded, setLoaded] = useState<BoothPreset>(slot ? { state: "loading" } : { state: "none" });
  // The shell rebuilds ctx on every status change; the ref keeps the read from repeating with it.
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const kind = slot?.kind ?? null;
  const id = slot?.id ?? null;
  useEffect(() => {
    if (!kind || !id) return setLoaded({ state: "none" });
    let live = true;
    setLoaded({ state: "loading" });
    api.current.getEditableEntity(`kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`).then((found) => {
      if (!live) return;
      const entity = found.entity as { kind?: string; body?: unknown } | null;
      const body = entity?.kind === kind ? asPresetBody(kind, entity.body) : null;
      setLoaded(body ? { state: "ready", body } : { state: "gone" });
    }, (e: unknown) => {
      if (live) setLoaded(e instanceof ApiHttpError && e.status === 404 ? { state: "gone" } : { state: "failed", why: toErrorMessage(e, "the preset could not be read") });
    });
    return () => { live = false; };
  }, [kind, id]);
  return loaded;
}
