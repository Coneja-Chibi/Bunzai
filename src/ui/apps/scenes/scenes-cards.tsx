/**
 * The Scenes list's card grid (approved wireframe design/wireframes/soft/scenes-game.html): a fixed
 * 2:3 portrait card per scene, the character's backdrop art (SceneArt), a take strip when the scene
 * has more than one take, and "Start New Story" on the character page. The hero's own scene is left
 * out of the grid by the caller (scenes-list.tsx), never here.
 */
import { useCallback, useMemo, useRef, type CSSProperties, type JSX, type KeyboardEvent } from "react";
import type { AppContext } from "../../app-contract";
import type { SceneSummary } from "../../../studio/scenes";
import { Ic } from "../../_shared/ic";
import { useAccentVars } from "../../_shared/use-scoped-accents";
import { since, sinceShort, splitByWeek, takePips } from "./scenes-core";
import { useSurfaceVariant } from "../../_shared/surface-variant";
import type { SceneRowProps } from "./scene-row";
import SaveFileSlot from "./variants/scenes.list/save-file-slots";
import ChatRow from "./variants/scenes.list/chat-list";
import ContentsEntry from "./variants/scenes.list/table-of-contents";
import { SceneArt } from "./scene-art";
import { ContextMenuButton } from "../../_shared/context-menu-button";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, rowsOf, useFocusedRangeIndex, useGridColumns, useOccurrenceKeys, useVirtualRows, type Range } from "../../_shared/virtual-list";
import { Card } from "../../components/button";

/** No specific scene backs "Start New Story", so it wears the house accent. */
const TONE: Record<`--${string}`, string> = { "--t": "var(--accent)" };

function TakeStrip({ s, always }: { s: SceneSummary; always?: boolean }): JSX.Element | null {
  if (!always && s.takeCount <= 1) return null;
  const { pips, overflow } = takePips(s.takeCount);
  const label = s.activeTake.original ? "Director's Cut" : s.activeTake.name;
  return (
    <div className="takestrip">
      <div className="compact">
        <span className="pips">
          {Array.from({ length: pips }, (_, i) => (
            <span key={i} className={(s.activeTake.original ? i === 0 : i === pips - 1) ? "on" : undefined} />
          ))}
        </span>
        {overflow > 0 && <span className="over">+{overflow}</span>}
        <span className="over">{s.takeCount} {s.takeCount === 1 ? "take" : "takes"}</span>
        <span className="active">{label}</span>
      </div>
    </div>
  );
}

/** Which row a theme's scenes.list pick draws in the list layout; the marquee-hero pick (and no pick) keeps the picture row. */
type RowStyle = "save-file-slots" | "chat-list" | "table-of-contents";
const ROWS = { "save-file-slots": SaveFileSlot, "chat-list": ChatRow, "table-of-contents": ContentsEntry } as const;

export function SceneCard({ ctx, s, picked, onClick, posinset, setsize, focusKey, compact }: { ctx: AppContext; s: SceneSummary; picked: boolean | null; onClick(): void; posinset: number; setsize: number; focusKey: string; compact?: boolean }): JSX.Element {
  const accentVars = useAccentVars();
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "scene", label: s.title, data: s }));
  const tone = accentVars(s.accent ?? "var(--accent)") as CSSProperties;
  const pick = useSurfaceVariant("scenes.list");
  const Row = compact && pick in ROWS ? ROWS[pick as RowStyle] : null;
  const rowProps: SceneRowProps | null = Row ? { s, index: posinset, art: <SceneArt ctx={ctx} chatId={s.id} characterId={s.cast.character.id} snapshotVersion={s.snapshotVersion} hasArt={s.hasPortrait} name={s.characterName} />,
    ago: { short: sinceShort(s.updatedAt, Date.now()), long: since(s.updatedAt, Date.now()) },
    takes: { ...takePips(s.takeCount), on: s.activeTake.original ? 0 : takePips(s.takeCount).pips - 1, label: `${s.takeCount} ${s.takeCount === 1 ? "take" : "takes"}` } } : null;
  return (
    <div className="scene-entry" data-part="scenes.card" data-pick={focusKey} ref={menuRef} style={tone}>
    <Card kind="art" data-part="scenes.card.open" aria-posinset={posinset} aria-setsize={setsize} data-hastakes={s.takeCount > 1 || compact ? "" : undefined} selected={picked === true} onClick={onClick}>
      {Row && rowProps ? <Row {...rowProps} /> : <div className="art">
        <SceneArt ctx={ctx} chatId={s.id} characterId={s.cast.character.id} snapshotVersion={s.snapshotVersion} hasArt={s.hasPortrait} name={s.characterName} />
        <div className="cont"><span>Continue &rarr;</span></div>
        <div className="ov">
          <div className="who">{s.characterName}</div>
          <h3>{s.title}</h3>
          {s.summaryPreview && <p className="sumline">{s.summaryPreview}</p>}
          <div className="meta"><b>{s.messageCount} {s.messageCount === 1 ? "msg" : "msgs"}</b><span>&bull;</span><span>{since(s.updatedAt, Date.now())}</span></div>
        </div>
        <TakeStrip s={s} always={compact} />
      </div>}
      {picked !== null && <span className="tick" />}
    </Card>
    {compact && <ContextMenuButton name={s.title} className="scene-more" />}
    </div>
  );
}

export function NewStoryCard({ characterName, onStart }: { characterName: string; onStart(): void }): JSX.Element {
  return (
    <Card kind="art" data-part="scenes.card.new" vars={TONE} onClick={onStart}>
      <span className="plus"><Ic name="lucide:plus" size={20} /></span>
      <b>Start New Story</b>
      <span className="with">with {characterName}</span>
    </Card>
  );
}

export function SceneGrid({ ctx, scenes, excludeId, picked, onPick, children, layout = "cards", groupByTime = true }: {
  ctx: AppContext;
  scenes: readonly SceneSummary[];
  /** the hero's own scene, never repeated here */
  excludeId?: string;
  picked: Set<string> | null;
  onPick(s: SceneSummary): void;
  /** extra cards (Start New Story) rendered after the scenes */
  children?: JSX.Element | null;
  layout?: "cards" | "list";
  groupByTime?: boolean;
}): JSX.Element {
  const cards = useMemo(() => [
    ...scenes.filter((scene) => scene.id !== excludeId).map((scene) => ({ scene })),
    ...(children ? [{ extra: children }] : []),
  ], [scenes, excludeId, children]);
  const periodLabels = useMemo(() => {
    const week = new Set(splitByWeek(scenes, Date.now()).thisWeek.map((s) => s.id));
    const label = (scene: SceneSummary): string => week.has(scene.id) ? "This Week" : "Earlier";
    return cards.map((card, index) => {
      if (!("scene" in card)) return null;
      const previous = cards[index - 1];
      return !previous || !("scene" in previous) || label(previous.scene) !== label(card.scene) ? label(card.scene) : null;
    });
  }, [cards, scenes]);
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(cards, "scene-grid", (card) => "scene" in card ? `scene:${card.scene.id}` : "extra", (card) => "scene" in card ? card.scene : card);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { cols: measuredCols, gapPx, rowRef } = useGridColumns();
  const cols = layout === "list" ? 1 : measuredCols;
  const rows = rowsOf(cards, cols);
  const flatIndex = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const { focusedIndex, onFocus, onBlur } = useFocusedRangeIndex(flatIndex, useCallback((index: number) => Math.floor(index / Math.max(1, cols)), [cols]),
    useCallback((index: number) => rowKeys[index], [rowKeys]), rowIndex, { restoreReparentedFocus: true });
  const virtualizer = useVirtualRows({
    mode: "grid",
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => layout === "list" ? 80 : 270,
    gap: gapPx,
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });
  const visible = virtualizer.getVirtualItems();
  const first = visible[0]?.index;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = flatIndex(document.activeElement as HTMLElement);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event,
      { scrollToIndex: (i, options) => virtualizer.scrollToIndex(Math.floor(i / Math.max(1, cols)), options) },
      cards.length, index, event.currentTarget, (i) => rowKeys[i]!);
  };
  return (
    <div className={`grid-scroll${layout === "list" ? " scene-list" : ""}`} ref={scrollRef} onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown}>
      <div className="grid-space" style={{ height: virtualizer.getTotalSize() }}>
        {visible.map((row) => (
          <div key={row.index} ref={(element) => { virtualizer.measureElement(element); if (row.index === first) rowRef(element); }}
            data-index={row.index} className="grid" style={{ transform: `translateY(${String(row.start)}px)` }}>
            {(rows[row.index] ?? []).map((card, index) => "scene" in card
              ? <div key={rowKeys[row.index * Math.max(1, cols) + index]}>
                {layout === "list" && groupByTime && periodLabels[row.index] && <h2 className="scene-period">{periodLabels[row.index]}</h2>}
                <SceneCard compact={layout === "list"} focusKey={rowKeys[row.index * Math.max(1, cols) + index]!} ctx={ctx} s={card.scene} picked={picked ? picked.has(card.scene.id) : null} posinset={row.index * Math.max(1, cols) + index + 1} setsize={cards.length} onClick={() => onPick(card.scene)} />
              </div>
              : <div key={rowKeys[row.index * Math.max(1, cols) + index]} data-pick={rowKeys[row.index * Math.max(1, cols) + index]}>{card.extra}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}
