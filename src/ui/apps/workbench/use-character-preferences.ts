/** Character editor preferences shared by its header and lens strip. */
import { useRef, useState } from "react";
import type { AppContext } from "../../app-contract";
import type { OffTarget } from "../../components/platform-tabs";
import { hasSeenTour, tourSeenKey } from "../../tours/tour-core";
import { migrateLensTargets } from "../../../formats/_shared/extension-platforms";
import { parseScale } from "./editor-derive";
import { strArray } from "../../../core/guards";

const PREF_TARGETS = "editor.targets";
const PREF_OFF_TARGET = "editor.offTarget";
const PREF_EDITOR_SCALE = "editor.scale";
const PREF_EDITOR_LAYOUT = "editor.layout";
const PREF_EDITOR_MODE = "editor.mode";
const SCALE_MIN = 0.5;
const SCALE_MAX = 2;
const SCALE_STEP = 0.1;

export function useCharacterPreferences(ctx: AppContext) {
  const [targets, setTargets] = useState<string[]>(() => {
    const raw = strArray(ctx.prefs.get(PREF_TARGETS));
    const next = migrateLensTargets(raw);
    if (JSON.stringify(next) !== JSON.stringify(raw)) ctx.prefs.set(PREF_TARGETS, next);
    return next;
  });
  const toggleTarget = (id: string): void => setTargets((prev) => {
    const next = prev.includes(id) ? prev.filter((target) => target !== id) : [...prev, id];
    ctx.prefs.set(PREF_TARGETS, next);
    return next;
  });
  const clearTargets = (): void => {
    setTargets([]);
    ctx.prefs.set(PREF_TARGETS, []);
  };

  const [offTarget, setOffTarget] = useState<OffTarget>(() => ctx.prefs.get(PREF_OFF_TARGET) === "dim" ? "dim" : "hide");
  const pickOffTarget = (mode: OffTarget): void => {
    setOffTarget(mode);
    ctx.prefs.set(PREF_OFF_TARGET, mode);
  };

  const [editorScale, setEditorScaleState] = useState<number>(() => parseScale(ctx.prefs.get(PREF_EDITOR_SCALE)));
  const scaleRef = useRef(editorScale);
  const setEditorScale = (next: number): void => {
    const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(next * 100) / 100));
    scaleRef.current = clamped;
    setEditorScaleState(clamped);
    ctx.prefs.set(PREF_EDITOR_SCALE, clamped);
  };
  const stepScale = (direction: -1 | 1): void => setEditorScale(scaleRef.current + direction * SCALE_STEP);

  const [editorLayout, setEditorLayoutState] = useState<"bento" | "playbill">(() =>
    ctx.prefs.get(PREF_EDITOR_LAYOUT) === "playbill" ? "playbill" : "bento",
  );
  const setEditorLayout = (layout: "bento" | "playbill"): void => {
    setEditorLayoutState(layout);
    ctx.prefs.set(PREF_EDITOR_LAYOUT, layout);
  };
  const [mode, setModeState] = useState<"grid" | "interview">(() =>
    ctx.prefs.get(PREF_EDITOR_MODE) === "interview" ? "interview" : "grid",
  );
  const setMode = (next: "grid" | "interview"): void => {
    setModeState(next);
    ctx.prefs.set(PREF_EDITOR_MODE, next);
  };

  return {
    targets, toggleTarget, clearTargets, offTarget, pickOffTarget,
    editorScale, setEditorScale, stepScale, editorLayout, setEditorLayout,
    mode, setMode, onboarded: hasSeenTour(ctx.prefs.get(tourSeenKey("workbench"))),
    scaleMin: SCALE_MIN, scaleMax: SCALE_MAX,
  };
}
