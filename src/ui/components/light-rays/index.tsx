/** Vaudeville OGL LightRays and evolving floor fog, with reduced-motion CSS fallback. */
import { useEffect, useRef, type JSX } from "react";
import { startLightRays } from "./renderer";
import styles from "./styles.module.css";

export function LightRays({ followMouse = true, mouseInfluence = .35 }: { followMouse?: boolean; mouseInfluence?: number }): JSX.Element {
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
      if (!motion.matches) stop = startLightRays(node, followMouse, mouseInfluence);
    };
    update();
    motion.addEventListener("change", update);
    return () => { motion.removeEventListener("change", update); stop?.(); };
  }, [followMouse, mouseInfluence]);
  return <div className={styles.rays} aria-hidden="true"><canvas ref={canvas} className={styles.canvas} /><div className={styles.fallback} /></div>;
}
