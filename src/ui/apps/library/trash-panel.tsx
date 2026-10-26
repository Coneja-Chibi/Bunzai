/**
 * The Library's Trash: RoleCall's Trash panel, ported (design/wireframes/rc-port/trash.html), holding
 * cut scenes and deleted takes beside the pieces (rc-port/scene-trash.html), filtered with RoleCall's
 * segmented toggle.
 * Deleted pieces, scenes, and takes stay 3 days (TRASH_DAYS in src/core/trash-window.ts); Restore brings one back under
 * its own id with its history, because a deleted id is never given to anything else.
 */
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import type { GraveSummary } from "../../../stage/contracts/content-store";
import type { SceneGrave } from "../../../studio/scenes";
import { daysLeft } from "../../../core/trash-window";
import type { AppContext } from "../../app-contract";
import { Icon } from "./icon";
import { FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, remToPx, useFocusedRangeIndex, useVirtualRows, type Range } from "../../_shared/virtual-list";
import { plural } from "../../../core/text";
import { icSvg } from "../../_shared/ic-svg";
import { Button, Segmented } from "../../components/button";

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
              <div className="trow" data-pick={g.key} aria-setsize={shown.length} aria-posinset={row.index + 1}>
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
      <div className="ltrash-empty">
        <Icon svg={TRASH_GLYPH} />
        <h2>Trash is empty</h2>
        <p>Deleted pieces and scenes remain here for 3 days, ready to restore.</p>
        <Button onClick={onBack}>Back to library</Button>
      </div>
    );
  }
  return (
    <section className="ltrash">
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
    </section>
  );
}

export const TRASH_STYLE = `
.lrail [data-part="library.trash"] .tile{color:var(--stage-danger-text)}
.lrail [data-part="library.trash"][data-selected] .tile{background:color-mix(in srgb,var(--stage-danger-edge) 22%,var(--stage-sunken));border-color:var(--stage-danger-edge)}
.ltrash{max-width:48rem;margin:0 auto;padding:1.75rem;border:1px solid color-mix(in srgb,var(--stage-danger-edge) 45%,transparent);background:color-mix(in srgb,var(--stage-danger-bg) 18%,transparent)}
.ltrash .head{display:flex;gap:.75rem;align-items:flex-start;margin-bottom:1.5rem;color:var(--stage-danger-text)}
.ltrash h2{margin:0;font-family:var(--font-fancy);font-size:1.125rem;font-weight:600;color:var(--text)}
.ltrash p{margin:.25rem 0 0;font-size: var(--text-body);line-height:1.6;color:var(--text-soft)}
/* the panel had no scroll box of its own before virtualizing (F1): its rows just grew the page.
   Bounded the same way the drop-in views are (.lview.libstage), so hundreds of graves scroll here
   instead of past the screen with nothing to stop them. */
.ltrash-rows{max-height:min(38rem,70vh);overflow-y:auto;margin-top:.5rem}
.ltrash .trow{display:flex;align-items:center;gap:.75rem;padding:.75rem;border:1px solid color-mix(in srgb,var(--text) 8%,transparent);background:color-mix(in srgb,var(--stage-black) 20%,transparent)}
.ltrash .who{flex:1;min-width:0}
.ltrash .nm{font-size:.875rem;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ltrash .ty{margin-top:.125rem;font-size:.75rem;color:var(--text-dim);text-transform:capitalize}
.ltrash .ty.scene{color:var(--deck-character);text-transform:none}
.ltrash .ty .ago{color:var(--text-faint);text-transform:none}
.ltrash .tfilter{margin:0 0 .75rem}
.ltrash .trow > :last-child{flex:none}
.ltrash-empty{max-width:28rem;margin:12vh auto 0;text-align:center;color:var(--text-dim)}
.ltrash-empty h2{margin:.75rem 0 0;font-family:var(--font-fancy);font-size:1.25rem;color:var(--text)}
.ltrash-empty p{margin:.375rem 0 0;font-size: var(--text-body);color:var(--text-soft)}
.ltrash-empty > :last-child{margin-top:1.125rem}
@container (max-width:40rem){.ltrash{padding:1.125rem}}
`;
