/** What a scenes.list row variant draws for one scene: the scene, its place in the list, the backdrop art and the take dots. */
import type { ReactNode } from "react";
import type { SceneSummary } from "../../../studio/scenes";

export interface SceneRowProps {
  s: SceneSummary;
  /** 1-based place in the whole list */
  index: number;
  art: ReactNode;
  /** when it was last played, short ("38m") and long ("38 minutes") */
  ago: { short: string; long: string };
  takes: { pips: number; overflow: number; on: number; label: string };
}
