/**
 * The Library's Trash: RoleCall's Trash panel, ported (design/wireframes/rc-port/trash.html), holding
 * cut scenes and deleted takes beside the pieces (rc-port/scene-trash.html), filtered with RoleCall's
 * segmented toggle.
 * Deleted pieces, scenes, and takes stay 3 days (TRASH_DAYS in src/core/trash-window.ts); Restore brings one back under
 * its own id with its history, because a deleted id is never given to anything else.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import type { GraveSummary } from "../../../stage/contracts/content-store";
import type { SceneGrave } from "../../../studio/scenes";
import { daysLeft } from "../../../core/trash-window";
import type { AppContext } from "../../app-contract";
import { Icon } from "./icon";
import { FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, remToPx, useFocusedRangeIndex, useVirtualRows, type Range } from "../../_shared/virtual-list";
import { plural } from "../../../core/text";
import { icSvg } from "../../_shared/ic-svg";
import { Button, Segmented } from "../../components/button";
import { Panel } from "../../components/panel";
import { deckMeta } from "../../_shared/decks";

/** One Trash row: a piece from the content store, or a scene or take from the chat store. */
type Row = { key: string; name: string; type: string; scene: boolean; deletedAt: number; /** A removed version never expires (ChatStore rule 32), so it shows no countdown. */ kept?: boolean; restore(): Promise<unknown> };
type Filter = "all" | "pieces" | "scenes";

async function trashRows(ctx: AppContext): Promise<Row[]> {
  const [pieces, scenes] = await Promise.all([
    ctx.api.listTrash(),
    ctx.api.listSceneTrash().catch((): SceneGrave[] => {
      ctx.setStatus("Scenes in the Trash could not be listed just now; they are still there.");
      return [];
    }),
  ]);
  return [
    ...pieces.map((g: GraveSummary): Row => ({ key: g.graveId, name: g.name, type: g.kind, scene: false, deletedAt: g.deletedAt, restore: () => ctx.api.restoreFromTrash(g.graveId) })),
    ...scenes.map((g): Row => ({
      key: `${g.kind}:${g.id}`,
      name: g.name,
      type: g.kind === "scene" ? `scene with ${g.of}, ${plural(g.messageCount, "message")}` : g.kind === "take" ? `take of ${g.of}, ${plural(g.messageCount, "message")}` : `version of message ${g.at ?? "?"} in ${g.of}`,
      scene: true,
      deletedAt: g.deletedAt,
      ...(g.kind === "version" ? { kept: true } : {}),
      restore: () => ctx.api.restoreSceneGrave(g.kind, g.id),
    })),
  ].sort((a, b) => b.deletedAt - a.deletedAt);
}

const ROW_ESTIMATE_PX = 54;
const ROW_GAP_REM = 0.5;

/**
 * VIRTUALIZED: the Trash keeps everything deleted in the last 3 days, so
 * a heavy delete pass (a purge, a batch cleanup) can leave hundreds of rows here. Its own bounded
 * scroll box (new: `.ltrash-rows`) is what makes that possible - the panel had no scroll container
 * of its own before (its rows simply grew the page), which a virtualizer needs to know when to stop
 * rendering.
 */
function TrashRows({ shown, restore }: { shown: readonly Row[]; restore(g: Row): Promise<void> }): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const flatIndexOfFocused = useCallback(
    (target: HTMLElement) => {
      const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
      return key ? shown.findIndex((g) => g.key === key) : -1;
    },
    [shown],
  );
  const identity = useCallback((flat: number) => flat, []);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndexOfFocused, identity);

  const virtualizer = useVirtualRows({
    mode: "list",
    count: shown.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: OVERSCAN,
    gap: remToPx(ROW_GAP_REM), // this row gap: baked into each row's own start below.
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]), // C-1: keep a focused row
    // mounted through a wheel/scrollbar scroll, not only reachable via Tab.
    initialRect: FALLBACK_VIEWPORT,
  });

  return (
    <div className="ltrash-rows" role="list" ref={scrollRef} onFocus={onFocus}>
      <div style={{ position: "relative", height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const g = shown[row.index];
          if (!g) return null;
          return (
            <div
              key={g.key}
              ref={virtualizer.measureElement}
              data-index={row.index}
              style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${String(row.start)}px)` }}
            >
              <div className="trow" data-pick={g.key} style={{ "--a": g.scene ? "var(--deck-character)" : deckMeta(g.type).accent } as CSSProperties} aria-setsize={shown.length} aria-posinset={row.index + 1}>
                <div className="who">
                  <div className="nm">{g.name}</div>
                  <div className={`ty${g.scene ? " scene" : ""}`}>{g.type} <span className="ago">{g.kept ? "kept until restored" : daysLeft(g.deletedAt, Date.now())}</span></div>
                </div>
                <Button size="sm" onClick={() => void restore(g)}>Restore</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const TRASH_GLYPH = icSvg("lucide:trash-2", 18);

/** How much the Trash holds, asked again whenever the studio's pieces change. `ctx` is NOT a dep:
 * it is rebuilt on every shell-store write (a status message...), and depending on it re-listed
 * the whole Trash on each one. Only a real `generation` change should. */
export function useTrashCount(ctx: AppContext, generation: unknown): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    trashRows(ctx).then((rows) => setCount(rows.length), () => setCount(0));
  }, [generation]); // eslint-disable-line react-hooks/exhaustive-deps
  return count;
}

export function TrashPanel({ ctx, onBack, onRestored }: { ctx: AppContext; onBack(): void; onRestored(): void }): JSX.Element {
  const [graves, setGraves] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => {
    // Mount only: this panel remounts fresh each time the Library opens it (index.tsx's `trashOn`
    // toggle), so mount already means "opened". Depending on `ctx` instead re-listed every grave
    // on any unrelated shell-store write while the panel stayed open.
    trashRows(ctx).then(setGraves, () => setGraves([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restore = async (g: Row): Promise<void> => {
    try {
      await g.restore();
      setGraves((all) => (all ?? []).filter((x) => x.key !== g.key));
      ctx.setStatus(g.scene ? `${g.name} is back in your Scenes.` : `${g.name} restored to your library.`);
      onRestored();
    } catch {
      ctx.setStatus(`${g.name} could not be restored. It may have expired from Trash.`);
    }
  };
  const scenes = (graves ?? []).filter((g) => g.scene).length;
  const shown = (graves ?? []).filter((g) => filter === "all" || (filter === "scenes") === g.scene);

  if (graves === null) return <div className="ltrash-empty" />;
  if (graves.length === 0) {
    return (
      <Panel as="div" className="ltrash-empty" data-part="library.trash.empty">
        <Icon svg={TRASH_GLYPH} />
        <h2>Trash is empty</h2>
        <p>Deleted pieces and scenes remain here for 3 days, ready to restore.</p>
        <Button onClick={onBack}>Back to library</Button>
      </Panel>
    );
  }
  return (
    <Panel className="ltrash" data-part="library.trash.panel">
      <div className="head">
        <Icon svg={TRASH_GLYPH} />
        <div>
          <h2>Trash</h2>
          <p>
            Deleted pieces and scenes stay here for 3 days. They no longer appear in your Library, your
            Scenes, or selection menus while in Trash. Restoring returns a piece with its history under its
            own name, and a scene or take with every message.
          </p>
        </div>
      </div>
      <div className="lrail-toggle tfilter">
        <Segmented
          label="Show"
          size="sm"
          value={filter}
          onChange={setFilter}
          items={[
            { value: "all", label: `All ${graves.length}` },
            { value: "pieces", label: `Pieces ${graves.length - scenes}` },
            { value: "scenes", label: `Scenes ${scenes}` },
          ]}
        />
      </div>
      <TrashRows shown={shown} restore={restore} />
    </Panel>
  );
}

export const TRASH_STYLE = `
/* the Trash panel: a danger top edge, a Show filter, then open rows with a deck edge (one frame: the panel) */
.lib .ltrash{max-width:51rem;width:100%;margin:.25rem auto 0;border-top-color:var(--stage-danger-edge);display:flex;flex-direction:column;gap:.875rem}
.ltrash .head{display:flex;gap:1rem;align-items:flex-start}
.ltrash .head .ico,.ltrash .head svg{color:var(--stage-danger-text);font-size:1.75rem;margin-top:.25rem}
.ltrash h2{margin:0;font:700 1.75rem/1.15 var(--font-fancy);color:var(--text)}
.ltrash p{margin:.375rem 0 0;font-size:.875rem;line-height:1.6;color:var(--text-dim)}
/* the panel had no scroll box of its own before virtualizing (F1): its rows just grew the page.
   Bounded the same way the drop-in views are (.lview.libstage), so hundreds of graves scroll here
   instead of past the screen with nothing to stop them. */
.ltrash-rows{max-height:min(38rem,70vh);overflow-y:auto}
.ltrash .trow{display:flex;align-items:center;gap:.875rem;padding:.75rem .875rem;border-left:4px solid var(--a,var(--accent));border-bottom:1px solid var(--hair);transition:transform .2s ease,background .2s ease}
.ltrash .trow:hover{transform:translateX(4px);background:color-mix(in srgb,var(--a,var(--accent)) 10%,transparent)}
.ltrash .who{flex:1;min-width:0}
.ltrash .nm{font:600 1rem var(--font-ui);color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ltrash .ty{margin-top:.125rem;font-size:var(--text-meta);color:var(--text-faint);text-transform:capitalize}
.ltrash .ty.scene{color:var(--deck-character);text-transform:none}
.ltrash .ty .ago{color:var(--text-faint);text-transform:none}
.ltrash .tfilter{margin:0;align-self:flex-start}
.ltrash .trow > :last-child{flex:none}
.lib .ltrash-empty{max-width:35rem;margin:6vh auto 0;padding:2rem;display:flex;flex-direction:column;align-items:center;gap:.5rem;text-align:center;color:var(--stage-danger-text)}
.ltrash-empty h2{margin:.5rem 0 0;font:700 1.625rem/1.2 var(--font-fancy);color:var(--text)}
.ltrash-empty p{margin:0;font:.9375rem/1.55 var(--font-ui);color:var(--text-dim)}
.ltrash-empty > :last-child{margin-top:.75rem}
@container (max-width:40rem){.lib .ltrash{padding:1.125rem}}
`;
