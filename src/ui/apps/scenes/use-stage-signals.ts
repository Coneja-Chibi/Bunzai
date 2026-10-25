/**
 * The Stage wing's Motion & Signals, as the scene page runs them: the auto-scroll mode (RoleCall page.tsx:2221-2307; Never leaves
 * the reader where they are, and Jump to latest, scene-find.tsx, is its indicator) and the Response Chime (page.tsx:1556,
 * useStreamingSync.ts:1703: one 800 Hz tone when a reply finishes while the tab is not in front).
 */
import { useEffect, useRef, type RefObject } from "react";
import { autoScrolls, chimeDue, type StageLook } from "./stage-look-core";

let tone: AudioContext | null = null;
/** One shared AudioContext, never closed (RoleCall's note: one per chime leaked an OS audio thread). */
function playChime(): void {
  try {
    tone ??= new AudioContext();
    if (tone.state === "suspended") void tone.resume().catch(() => undefined);
    const osc = tone.createOscillator();
    const gain = tone.createGain();
    osc.connect(gain);
    gain.connect(tone.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    gain.gain.exponentialRampToValueAtTime(0.01, tone.currentTime + 0.3);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    osc.start();
    osc.stop(tone.currentTime + 0.3);
  } catch {
    // no audio device or autoplay refused: the chime is a courtesy
  }
}

export function useStageSignals({ look, scroller, following, sceneKey, messageCount, liveText, busy }: {
  look: StageLook; scroller: RefObject<HTMLDivElement | null>; following: RefObject<boolean>; sceneKey: string | undefined; messageCount: number; liveText: string | undefined; busy: boolean;
}): void {
  const key = useRef(sceneKey);
  const mode = useRef(look.autoScroll);
  mode.current = look.autoScroll;
  useEffect(() => {
    const opened = key.current !== sceneKey;
    key.current = sceneKey;
    const el = scroller.current;
    if (el && autoScrolls(mode.current, following.current, opened)) el.scrollTop = el.scrollHeight;
  }, [scroller, following, sceneKey, messageCount, liveText, busy]);
  const was = useRef(busy);
  const chime = useRef(look.chime);
  chime.current = look.chime;
  useEffect(() => {
    if (chimeDue(was.current, busy, document.hidden || !document.hasFocus(), chime.current)) playChime();
    was.current = busy;
  }, [busy]);
}
