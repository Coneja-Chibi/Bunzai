/**
 * The title screen's behavior, shared by every shell.title variant: the newest scene for "continue", the five
 * ways out (each dismisses once into its destination), and the Enter key. A variant draws these; it never owns them.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { handOffScene } from "../_shared/scene-handoff";
import { requestImport } from "../_shared/import-signal";
import type { SceneSummary } from "../../studio/scenes";

export interface TitleState {
  sheetRef: RefObject<HTMLElement | null>;
  /** the fade-out is under way: every action is inert */
  closing: boolean;
  /** the newest real scene, or null when there is none (or the list failed) */
  recent: SceneSummary | null;
  sceneState: string;
  enter(): void;
  continueStory(): void;
  importPiece(): void;
  startStory(): void;
  browseStories(): void;
}

export function useTitle(onDone: (appId?: string) => void, listScenes: () => Promise<SceneSummary[]>): TitleState {
  const [closing, setClosing] = useState(false);
  const leaving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const [recent, setRecent] = useState<SceneSummary | null>(null);
  const [sceneState, setSceneState] = useState("Loading your stories…");
  useEffect(() => {
    let live = true;
    listScenes().then(rows => {
      if (!live) return;
      setRecent(rows.reduce<SceneSummary | null>((latest, row) => !latest || row.updatedAt > latest.updatedAt ? row : latest, null));
      setSceneState(rows.length ? "Now playing" : "Your first story awaits");
    }, () => { if (live) setSceneState("Browse your stories in Scenes"); });
    return () => { live = false; };
  }, [listScenes]);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);

  const go = useCallback((appId?: string): void => {
    if (leaving.current) return;
    leaving.current = true;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) onDone(appId);
    else {
      setClosing(true);
      timer.current = setTimeout(() => onDone(appId), 250);
    }
  }, [onDone]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" || event.defaultPrevented || event.isComposing || event.repeat ||
        event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.target !== sheetRef.current && event.target !== document.body) return;
      event.preventDefault();
      go();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return {
    sheetRef, closing, recent, sceneState,
    enter: () => go(),
    continueStory: () => { handOffScene(recent?.id ?? null); go("scenes"); },
    importPiece: () => { requestImport(); go("library"); },
    startStory: () => go("library"),
    browseStories: () => { handOffScene(null); go("scenes"); },
  };
}
