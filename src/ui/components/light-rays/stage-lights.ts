/** What the rays actually do, from the user's Stage lights choice and Reduce motion. */
import { stageLightsOf } from "../../../studio/settings-shape";
import type { StageLights } from "../../../studio/settings-shape";

/** Reduce motion holds moving rays to one still frame, and never switches an Off back on. */
export const effectiveStageLights = (value: unknown, reduceMotion: boolean): StageLights => {
  const mode = stageLightsOf(value);
  return reduceMotion && mode === "moving" ? "still" : mode;
};
