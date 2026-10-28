/**
 * Where a tracker or a tool is linked, said in the editor header: "linked in 2 scenes" or "not linked to a scene", read from the scenes' settings
 * (ctx.api.getLinkedScenes). Clicking it lists the scenes by name. The number is information about the piece, not a limit on it, and nothing here warns.
 */
import { useRef, useState, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { VirtualRows } from "../../../_shared/virtual-list";
import { Button } from "../../../components/button";
import { useLoaded } from "./use-loaded";
import s from "./piece.module.css";

const ROW_ESTIMATE = 28;

/** The header words for a piece linked in this many scenes. */
export const linkedText = (scenes: number): string => (scenes === 0 ? "not linked to a scene" : `linked in ${String(scenes)} ${scenes === 1 ? "scene" : "scenes"}`);

export function LinkedScenes({ ctx, kind, id }: { ctx: AppContext; kind: string; id: string }): JSX.Element | null {
  const found = useLoaded(() => ctx.api.getLinkedScenes(kind, id), "where it is linked");
  const [open, setOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  if (found.state === "loading") return null;
  if (found.state === "failed") return <span>{found.why}</span>;
  const scenes = found.value;
  if (scenes.length === 0) return <span>{linkedText(0)}</span>;
  return (
    <span className={s.linked} data-part="piece.linked">
      <Button variant="link" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>{linkedText(scenes.length)}</Button>
      {open && (
        <div ref={scroller} className={s.linkedList} role="region" aria-label="Scenes that link it">
          <VirtualRows scroll={scroller} items={scenes} keyOf={(scene) => scene.chatId} estimate={ROW_ESTIMATE} pick={false}
            render={(scene) => <div className={s.linkedRow}>{scene.title}</div>} />
        </div>
      )}
    </span>
  );
}
