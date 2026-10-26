/**
 * Edit history (approved wireframe rc-port/scene-history.html; RoleCall has no history list, so it borrows
 * the look of its More overflow menu). A popover under a bubble's More: the text now, then every text this
 * version had before, newest first, each with Restore. Restore saves through the normal edit, so the text
 * it replaces joins the list and a restore can itself be undone..
 */
import { useLayoutEffect, useRef, useState, type JSX } from "react";
import { Button } from "../../components/button";
import { historyRows } from "./scene-history-core";

export interface HistoryView {
  /** The text the version holds now (stored text, not macro-expanded). */
  current: string;
  /** Every earlier text, oldest first (ChatStore rule 5). */
  texts: string[];
}

/** The Edit history popover: the text now, then each earlier text newest first with Restore. */
export function HistoryList({ history, onRestore }: { history: HistoryView; onRestore(index: number): void }): JSX.Element {
  const rows = historyRows(history.current, history.texts);
  const box = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(false);
  // It opens above the bubble like More; a bubble near the top of the page has no room there, so it opens below.
  useLayoutEffect(() => {
    const el = box.current;
    const top = el?.closest(".scroll")?.getBoundingClientRect().top;
    if (el && top !== undefined && el.getBoundingClientRect().top < top) setBelow(true);
  }, []);
  return (
    <div ref={box} className={`histlist${below ? " below" : ""}`} role="dialog" aria-label="Edit history">
      <header><b>Edit history</b><small>this version, newest first</small></header>
      {history.texts.length === 0 ? (
        <div className="none">No edits yet. The first edit you save will appear here.</div>
      ) : (
        <>
          <div className="rows">
            {rows.map((r) => (
              <div key={r.label + (r.index ?? "now")} className={`row${r.index === null ? " now" : ""}`}>
                <div className="t">
                  <div className="n">{r.index === null ? r.label : `${r.label} · ${r.words} ${r.words === 1 ? "word" : "words"}`}</div>
                  <div className="p">{r.preview}</div>
                </div>
                {r.index !== null && <Button size="sm" onClick={() => onRestore(r.index!)}>Restore</Button>}
              </div>
            ))}
          </div>
          <footer>Restoring keeps the text it replaces here, so you can undo a restore.</footer>
        </>
      )}
    </div>
  );
}
