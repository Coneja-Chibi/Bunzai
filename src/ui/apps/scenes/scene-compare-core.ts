/**
 * The facts RoleCall's SwipeCompareModal shows for a version (SwipeCompareModal.tsx:33-54, 56-120): the
 * label, the time, the model with its "Unknown Model" fallback, and the generation details (preset,
 * temperature, top P, top K, min P). Pure: no React, no clock of its own.
 */
import type { Swipe } from "../../../stage/contracts/chat-store";
import { dateTimeStamp } from "./scene-meta-core";

export interface CompareMeta {
  label: string;
  /** "Oct 8, 09:05", or empty when the version has no time. */
  time: string;
  model: string;
  modelKnown: boolean;
  /** The preset the version was written under; null when unknown. */
  preset: string | null;
  samplers: Array<{ label: string; value: string }>;
  /** Preset or samplers known: the Generation Details fold has something to open. */
  hasDetails: boolean;
}

/** Left opens on the version the reader was on, right on the next one (the previous when it is the last). */
export function compareStart(current: number, count: number): { left: number; right: number } {
  return { left: current, right: current < count - 1 ? current + 1 : Math.max(0, current - 1) };
}

// RoleCall prints these four, in this order and precision. Bunraku's preset samplers are camelCase.
const SAMPLER_ROWS: ReadonlyArray<{ key: string; label: string; digits: number }> = [
  { key: "temperature", label: "Temperature", digits: 2 },
  { key: "topP", label: "Top P", digits: 2 },
  { key: "topK", label: "Top K", digits: 0 },
  { key: "minP", label: "Min P", digits: 3 },
];

export function compareMeta(index: number, swipe: Pick<Swipe, "createdAt" | "generation">): CompareMeta {
  const gen = swipe.generation;
  const samplers = SAMPLER_ROWS.flatMap(({ key, label, digits }) => {
    const value = gen?.samplers?.[key];
    return typeof value === "number" && Number.isFinite(value) ? [{ label, value: value.toFixed(digits) }] : [];
  });
  const preset = gen?.presetName ? gen.presetName : null;
  return { label: `Version ${index + 1}`, time: dateTimeStamp(swipe.createdAt), model: gen?.model || "Unknown Model", modelKnown: Boolean(gen?.model), preset, samplers, hasDetails: preset !== null || samplers.length > 0 };
}
