/**
 * Answers a mini player's chevron (stage-open.ts): opens the Stage wing and hands it the tab that was asked for. A Storyboard's gear (storyboards-open.ts) opens the World wing the same way. The page owns which wing is
 * open, so it calls this with its wing setter; the Stage wing owns its active tab, so it receives the request numbered (`n`) and
 * honours each number once, which keeps a request from a minute ago from re-picking a tab when the wing is opened again later.
 */
import { useEffect, useState } from "react";
import { STORYBOARDS_OPEN_EVENT } from "./compendium/storyboards/storyboards-open";
import { nextStageRequest, STAGE_OPEN_EVENT, type StageOpenDetail } from "./stage-open";
import { DIRECTOR_SETTINGS_OPEN_EVENT } from "./props/story-director/director-live";

export interface StageOpenRequest extends StageOpenDetail { n: number }

export function useStageOpen(openWing: (wing: string) => void): StageOpenRequest | null {
  const [request, setRequest] = useState<StageOpenRequest | null>(null);
  useEffect(() => {
    const on = (e: Event): void => {
      const tab = (e as CustomEvent<StageOpenDetail>).detail.tab;
      setRequest({ tab, n: nextStageRequest() });
      openWing("stage");
    };
    const world = (): void => openWing("world");
    const props = (): void => openWing("props");
    window.addEventListener(STAGE_OPEN_EVENT, on);
    window.addEventListener(STORYBOARDS_OPEN_EVENT, world);
    window.addEventListener(DIRECTOR_SETTINGS_OPEN_EVENT, props);
    return () => { window.removeEventListener(STAGE_OPEN_EVENT, on); window.removeEventListener(STORYBOARDS_OPEN_EVENT, world); window.removeEventListener(DIRECTOR_SETTINGS_OPEN_EVENT, props); };
  }, [openWing]);
  return request;
}
