/** Vaudeville OGL LightRays and evolving floor fog (fog can be switched off), with reduced-motion CSS fallback. The user's Stage lights choice (Settings > Appearance) sets Moving, Still (one frame) or Off (nothing drawn). */
import { useEffect, useRef, type JSX } from "react";
import { SETTING_KEYS } from "../../../studio/settings-shape";
import { reduceMotionOf } from "../../_shared/accessibility-prefs";
import { useShellStore } from "../../shell/store";
import { startLightRays } from "./renderer";
import { effectiveStageLights } from "./stage-lights";
import styles from "./styles.module.css";

export function LightRays({ followMouse = true, mouseInfluence = .35, fog = true }: { followMouse?: boolean; mouseInfluence?: number; fog?: boolean }): JSX.Element | null {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mode = useShellStore((s) => effectiveStageLights(s.settings[SETTING_KEYS.uiStageLights], reduceMotionOf(s.settings[SETTING_KEYS.uiReduceMotion])));
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let stop: (() => void) | null = null;
    const update = (): void => {
      stop?.();
      stop = null;
      node.dataset.raysReady = "false";
      if (!motion.matches) stop = startLightRays(node, followMouse, mouseInfluence, fog, mode === "moving");
    };
    update();
    motion.addEventListener("change", update);
    return () => { motion.removeEventListener("change", update); stop?.(); };
  }, [followMouse, mouseInfluence, fog, mode]);
  if (mode === "off") return null;
  return <div className={styles.rays} aria-hidden="true"><canvas ref={canvas} className={styles.canvas} /><div className={styles.fallback} /></div>;
}
