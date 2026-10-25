/**
 * Compare versions, as RoleCall's SwipeCompareModal draws it (SwipeCompareModal.tsx:137-325): two panels
 * side by side, each with its own previous and next arrows, "Version N", the time, the model and a
 * Generation Details fold (preset and samplers), and a warning when both show the same version. Like
 * RoleCall it only shows; picking a version is the message's own counter. Unlike RoleCall, a panel
 * opens one version cell at a time (getSceneSwipe) instead of holding every version of the message.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import { toErrorMessage } from "../../_shared/error-message";
import { Ic } from "../../_shared/ic";
import { InkDialog } from "../../components/ink-dialog";
import type { Swipe } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";
import { Prose } from "./prose";
import { compareMeta, compareStart } from "./scene-compare-core";
import { currentIndex, swipeCount } from "./use-scene-swipe-preview";

type Cell = { state: "loading" } | { state: "ready"; swipe: Swipe } | { state: "failed"; message: string };

export interface CompareTarget { chatId: string; branchId: string; branchVersion: number; messageId: string; count: number; current: number }

/** Loads each version the panels ask for once, against the same take and version the page shows. */
function useCells(api: AppContext["api"], t: CompareTarget, wanted: number[], onStale: () => void, setStatus: (text: string) => void): Map<number, Cell> {
  const [cells, setCells] = useState<Map<number, Cell>>(() => new Map());
  const asked = useRef(new Set<number>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const key = wanted.join(",");
  useEffect(() => {
    for (const index of wanted) {
      if (asked.current.has(index)) continue;
      asked.current.add(index);
      setCells((prev) => new Map(prev).set(index, { state: "loading" }));
      api.getSceneSwipe({ chatId: t.chatId, branchId: t.branchId, messageId: t.messageId, index, expectedVersion: t.branchVersion }).then((page) => {
        if (!alive.current) return;
        const cell: Cell = page.swipe && page.branchId === t.branchId && page.branchVersion === t.branchVersion
          ? { state: "ready", swipe: page.swipe } : { state: "failed", message: "This version is no longer in the scene." };
        setCells((prev) => new Map(prev).set(index, cell));
      }, (error: unknown) => {
        if (!alive.current) return;
        if (/\bversion\b|409/i.test(toErrorMessage(error))) {
          setStatus("the scene changed while its versions were loading; it has been reloaded");
          onStale();
        } else setCells((prev) => new Map(prev).set(index, { state: "failed", message: `Could not load this version: ${toErrorMessage(error)}` }));
      });
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- `wanted` is derived from the two panel indexes in `key`
  return cells;
}

function Panel({ index, count, cell, onStep }: { index: number; count: number; cell: Cell | undefined; onStep(delta: number): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const meta = cell?.state === "ready" ? compareMeta(index, cell.swipe) : null;
  return (
    <section className="pane" aria-label={`Version ${index + 1} of ${count}`}>
      <header>
        <button type="button" aria-label="Previous version" disabled={index <= 0} onClick={() => onStep(-1)}><Ic name="lucide:chevron-left" /></button>
        <div className="who">
          <b>Version {index + 1}</b>
          {meta?.time && <span className="when">{meta.time}</span>}
          {meta && <span className={`mdl${meta.modelKnown ? "" : " unk"}`}>{meta.model}</span>}
          {meta && (meta.hasDetails ? (
            <>
              <button type="button" className="fold" aria-expanded={open} onClick={() => setOpen(!open)}><Ic name="lucide:sliders-vertical" size={14} />Generation Details<Ic name="lucide:chevron-down" size={12} /></button>
              {open && (
                <dl className="gen">
                  <div><dt>Preset</dt><dd className={meta.preset ? undefined : "unk"}>{meta.preset ?? "Unknown"}</dd></div>
                  {meta.samplers.map((s) => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
                </dl>
              )}
            </>
          ) : <span className="none">No generation details available</span>)}
        </div>
        <button type="button" aria-label="Next version" disabled={index >= count - 1} onClick={() => onStep(1)}><Ic name="lucide:chevron-right" /></button>
      </header>
      <div className="txt">
        {cell?.state === "ready" ? <Prose text={cell.swipe.content} /> : cell?.state === "failed" ? <p className="bad" role="alert">{cell.message}</p> : <p className="wait" role="status">Loading this version...</p>}
      </div>
    </section>
  );
}

export function CompareDialog({ api, target, onClose, onStale, setStatus }: { api: AppContext["api"]; target: CompareTarget; onClose(): void; onStale(): void; setStatus(text: string): void }): JSX.Element {
  const [at, setAt] = useState(() => compareStart(target.current, target.count));
  const cells = useCells(api, target, [...new Set([at.left, at.right])], onStale, setStatus);
  return (
    <InkDialog onDismiss={onClose} ariaLabel="Compare versions" sheetClassName="cmp-sheet">
      <div className="cmp">
        <header className="top"><h2>Compare Versions</h2><button type="button" aria-label="Close" onClick={onClose}><Ic name="lucide:x" /></button></header>
        <div className="panes">
          <Panel index={at.left} count={target.count} cell={cells.get(at.left)} onStep={(d) => setAt((p) => ({ ...p, left: p.left + d }))} />
          <Panel index={at.right} count={target.count} cell={cells.get(at.right)} onStep={(d) => setAt((p) => ({ ...p, right: p.right + d }))} />
        </div>
        {at.left === at.right && <p className="same" role="status">Both panels are showing the same version</p>}
      </div>
    </InkDialog>
  );
}

/** The page's one mount: finds the message in the open scene and compares its saved versions. Nothing when it has fewer than two or is gone. */
export function SceneCompare({ api, chatId, scene, messageId, onClose, onStale, setStatus }: { api: AppContext["api"]; chatId: string; scene: OpenScene; messageId: string; onClose(): void; onStale(): void; setStatus(text: string): void }): JSX.Element | null {
  const m = scene.messages.find((x) => x.id === messageId);
  const count = m ? swipeCount(m) : 0;
  if (!m || count < 2) return null;
  const target: CompareTarget = { chatId, branchId: scene.chat.activeBranchId, branchVersion: scene.branchVersion, messageId, count, current: currentIndex(m) };
  return <CompareDialog api={api} target={target} onClose={onClose} onStale={onStale} setStatus={setStatus} />;
}
