/**
 * The Messenger's read marks as state (prefs are not reactive): the saved map, and the open scene marked read up to its live message count whenever the scene is loaded and the page is in
 * view. A new reply while the scene is open and visible, a send, and returning to the tab all move the mark; a hidden tab does not, so replies that arrive while the person is away stay unread.
 */
import { useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../../app-contract";
import { markRead, readMarks, type ReadMarks } from "./read-marks";

const inView = (): boolean => typeof document === "undefined" || document.visibilityState === "visible";

export function useReadMarks(prefs: AppContext["prefs"], chatId: string, messageCount: number | null): ReadMarks {
  const [marks, setMarks] = useState(() => readMarks(prefs));
  const saved = useRef(marks);
  const [visible, setVisible] = useState(inView);
  useEffect(() => {
    const on = (): void => setVisible(inView());
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  useEffect(() => {
    if (messageCount === null || !visible) return;
    const next = markRead(prefs, saved.current, chatId, messageCount, Date.now());
    if (next === saved.current) return;
    saved.current = next;
    setMarks(next);
  }, [prefs, chatId, messageCount, visible]);
  return marks;
}
