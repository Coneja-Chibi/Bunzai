/** Vaudeville OGL LightRays and evolving floor fog (fog can be switched off), with reduced-motion CSS fallback. */
import { useEffect, useRef, type JSX } from "react";
import { startLightRays } from "./renderer";
import styles from "./styles.module.css";

export function LightRays({ followMouse = true, mouseInfluence = .35, fog = true }: { followMouse?: boolean; mouseInfluence?: number; fog?: boolean }): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let stop: (() => void) | null = null;
    const update = (): void => {
      stop?.();
      stop = null;
      node.dataset.raysReady = "false";
      if (!motion.matches) stop = startLightRays(node, followMouse, mouseInfluence, fog);
    };
    update();
    motion.addEventListener("change", update);
    return () => { motion.removeEventListener("change", update); stop?.(); };
  }, [followMouse, mouseInfluence, fog]);
  return <div className={styles.rays} aria-hidden="true"><canvas ref={canvas} className={styles.canvas} /><div className={styles.fallback} /></div>;
}
