/**
 * The Pipeline layer's data: the scene list, the picked scene's cast, the context character's and
 * persona's bodies and lorebooks (read only when they are not already on the canvas), and the scene's
 * request forecast. Everything here is read-only; the layer's one write is preset-write.ts.
 */
import { useEffect, useMemo, useState } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { SceneSummary } from "../../../../studio/scenes";
import { toErrorMessage } from "../../../_shared/error-message";
import { keyOf } from "../../../_shared/piece-key";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import { bodyFromEntity } from "../lore/light-read";
import { readSource } from "./link-write";
import { contextOf, loreIdsOf, loreStats, slotTexts, type ForecastState, type LoreStats, type PipelineContext } from "./pipeline";

export interface PipelineData {
  scenes: readonly SceneSummary[];
  scene: SceneSummary | null;
  setSceneId(id: string | null): void;
  context: PipelineContext;
  texts: Partial<Record<string, string>>;
  lore: LoreStats | null;
  loreIds: readonly string[];
  forecast: ForecastState;
}

export function usePipeline(
  ctx: AppContext,
  pieces: readonly StudioEntitySummary[],
  bodies: Readonly<Record<string, unknown>>,
  /** the preset the request is built from; the forecast is asked again whenever its body is read anew */
  requestBody: unknown,
  enabled: boolean,
): PipelineData {
  const [scenes, setScenes] = useState<readonly SceneSummary[]>([]);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [books, setBooks] = useState<Record<string, LorebookBody | null>>({});
  const [forecast, setForecast] = useState<ForecastState>({ t: "none" });

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    ctx.api.listScenes().then(
      (rows) => { if (live) setScenes(rows); },
      (e) => { if (live) ctx.setStatus(`could not list scenes · ${toErrorMessage(e)}`); },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const scene = scenes.find((s) => s.id === sceneId) ?? null;
  const context = useMemo(
    () => contextOf(
      scene && { characterId: scene.cast.character.id, characterName: scene.cast.character.name ?? scene.characterName, ...(scene.cast.persona ? { personaId: scene.cast.persona.id, personaName: scene.cast.persona.name ?? "" } : {}) },
      pieces,
    ),
    [scene, pieces],
  );
  const characterKey = context.character ? keyOf(context.character.id, "character") : null;
  const personaKey = context.persona ? keyOf(context.persona.id, "persona") : null;
  const bodyOf = (key: string | null): unknown => (key ? bodies[key] ?? extra[key] : undefined);
  const characterBody = bodyOf(characterKey);
  const personaBody = bodyOf(personaKey);

  // a scene's character or persona that is not on the canvas is read once, like the Desk would
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    for (const [piece, kind] of [[context.character, "character"], [context.persona, "persona"]] as const) {
      if (!piece) continue;
      const key = keyOf(piece.id, kind);
      if (bodies[key] !== undefined || extra[key] !== undefined) continue;
      void readSource(ctx, kind, piece.id).then(
        (r) => { if (live) setExtra((prev) => ({ ...prev, [key]: r.entity.body })); },
        () => { if (live) ctx.setStatus(`could not read ${piece.name} for the pipeline`); },
      );
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, characterKey, personaKey, bodies]);

  const loreIds = useMemo(
    () => loreIdsOf(characterBody, personaBody, scene?.lore ?? null),
    [characterBody, personaBody, scene],
  );
  const loreStamp = loreIds.map((id) => `${id}@${ctx.pieces.snapshot("lorebook", id)?.revision ?? ""}`).join("|");
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    for (const id of loreIds) {
      void ctx.api.getLightEditableEntity(`kind=lorebook&id=${encodeURIComponent(id)}`).then(
        (r) => { if (live) setBooks((prev) => ({ ...prev, [id]: bodyFromEntity(r.entity) })); },
        () => { if (live) setBooks((prev) => ({ ...prev, [id]: null })); },
      );
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loreStamp]);
  const lore = useMemo(
    () => (loreIds.length === 0 ? null : loreStats(loreIds.flatMap((id) => (books[id] ? [books[id]!] : [])))),
    [loreIds, books],
  );

  useEffect(() => {
    if (!enabled || !scene) { setForecast({ t: "none" }); return; }
    const controller = new AbortController();
    setForecast({ t: "loading" });
    ctx.api.getSceneForecast(scene.id, "", controller.signal).then(
      (f) => { if (!controller.signal.aborted) setForecast({ t: "ready", forecast: f }); },
      (e) => { if (!controller.signal.aborted) setForecast({ t: "error", message: toErrorMessage(e) }); },
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scene?.id, requestBody]);

  const texts = useMemo(() => slotTexts(characterBody, personaBody), [characterBody, personaBody]);
  return { scenes, scene, setSceneId, context, texts, lore, loreIds, forecast };
}
