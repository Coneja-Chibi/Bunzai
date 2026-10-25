/** Preserve CSS motion while the watchdog synchronously samples the host-only appearance. */
interface SavedMotion {
  animation: Animation;
  name: string;
  transition: boolean;
  target: Element | null;
  pseudo: string | null;
  time: CSSNumberish | null;
  rate: number;
  paused: boolean;
  frames?: Keyframe[];
  timing?: OptionalEffectTiming;
}
const cssMotion = (animation: Animation): { name: string; transition: boolean } | null =>
  "animationName" in animation ? { name: String(animation.animationName), transition: false } :
    "transitionProperty" in animation ? { name: String(animation.transitionProperty), transition: true } : null;
const sampledStarts = new Map<EventTarget, Set<string>>();
let clearFrame = 0;
let frameWindow: Window | null = null;

export function clearBaselineMotion(): void {
  frameWindow?.cancelAnimationFrame(clearFrame);
  sampledStarts.clear(); clearFrame = 0; frameWindow = null;
}

/** Recreated CSS animation starts are measurement effects, not another change to scan. */
export function isBaselineAnimationStart(event: Event): boolean {
  const animation = event as AnimationEvent;
  return event.type === "animationstart" && event.target !== null &&
    sampledStarts.get(event.target)?.has(animation.animationName + ":" + animation.pseudoElement) === true;
}

/** Snapshot CSS motion only; script animations remain untouched. */
export function preserveCssMotion(doc: Document): () => void {
  const saved: SavedMotion[] = (doc.getAnimations?.() ?? []).flatMap((animation) => {
    const motion = cssMotion(animation), effect = animation.effect as KeyframeEffect | null;
    const { duration, ...timing } = effect?.getTiming?.() ?? {};
    return !motion || !effect ? [] : [{
      ...motion, animation, target: effect.target, pseudo: effect.pseudoElement,
      time: animation.currentTime, rate: animation.playbackRate, paused: animation.playState === "paused",
      ...(motion.transition ? { frames: effect.getKeyframes(), timing: {
        ...timing, duration: typeof duration === "number" || typeof duration === "string" ? duration : undefined,
      } } : {}),
    }];
  });
  return () => {
    if (saved.length === 0) return;
    for (const animation of doc.getAnimations()) {
      const effect = animation.effect as KeyframeEffect | null, motion = cssMotion(animation);
      if (!effect || !motion) continue;
      const at = saved.findIndex((old) => old.target === effect.target && old.pseudo === effect.pseudoElement &&
        old.name === motion.name && old.transition === motion.transition);
      if (at < 0) { if (motion.transition) animation.finish(); continue; }
      const old = saved.splice(at, 1)[0]!;
      if (animation === old.animation) continue;
      if (old.frames && old.timing) { effect.setKeyframes(old.frames); effect.updateTiming(old.timing); }
      animation.playbackRate = old.rate;
      animation.currentTime = old.time;
      if (old.paused) animation.pause();
      if (!motion.transition && effect.target) {
        const names = sampledStarts.get(effect.target) ?? new Set<string>();
        names.add(motion.name + ":" + (effect.pseudoElement ?? ""));
        sampledStarts.set(effect.target, names);
      }
    }
    if (sampledStarts.size && doc.defaultView) {
      frameWindow?.cancelAnimationFrame(clearFrame);
      frameWindow = doc.defaultView;
      clearFrame = frameWindow.requestAnimationFrame(() => {
        clearFrame = frameWindow!.requestAnimationFrame(() => { sampledStarts.clear(); clearFrame = 0; frameWindow = null; });
      });
    }
  };
}
