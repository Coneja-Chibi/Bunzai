/**
 * The Scenes list's sidebar (approved wireframe design/wireframes/soft/scenes-game.html): the cast
 * rail (one tile per character, most recent scene's art, a "now playing" marker) and, beside it, the
 * stage panel - Fan Favorites (a sliding carousel of starred scenes), This Week / Earlier recent
 * rows, the cut list with Restore (unchanged from the plain list), Smart Folders (Longest Stories),
 * and Folders with New Folder. No tabs (Bunraku has no group scenes) and no per-row message
 * snippet (sceneTail is a per-scene call; fetching one per recent row would be N+1 requests, so
 * these rows show the character's name instead, same data the plain list showed).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type JSX, type KeyboardEvent } from "react";
import type { AppContext } from "../../app-contract";
import type { SceneFolder } from "../../../stage/contracts/chat-store";
import type { SceneGrave, SceneSummary } from "../../../studio/scenes";
import { Ic } from "../../_shared/ic";
import { useAccentVars } from "../../_shared/use-scoped-accents";
import { daysLeft } from "../../../core/trash-window";
import { useVisibleInterval } from "../../_shared/use-visible-interval";
import { SceneArt } from "./scene-art";
import { castRail, fanFavorites, folderTint, sinceShort, splitByWeek, type CastTile } from "./scenes-core";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, useFocusedRangeIndex, useOccurrenceKeys, useVirtualRows, type Range } from "../../_shared/virtual-list";

export type RailSelection = { kind: "all" } | { kind: "char"; id: string } | { kind: "folder"; id: string } | { kind: "smart" };

const reducedMotion = (): boolean => {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
};

function FavCarousel({ ctx, favorites, onOpen }: { ctx: AppContext; favorites: SceneSummary[]; onOpen(id: string): void }): JSX.Element {
  const accentVars = useAccentVars();
  const [i, setI] = useState(0);
  const hoveredRef = useRef(false);
  const elRef = useRef<Element | null>(null);
  // keyed on the favorites' identity, not the array: the list re-renders on every search keystroke
  const key = favorites.map((f) => f.id).join(" ");
  useEffect(() => setI(0), [key]);
  const advancing = favorites.length >= 2 && !reducedMotion();
  // Stopped (not merely paused) while the tab is hidden or the carousel is scrolled off screen:
  // the scale design, the favorites carousel is a named row in the idle audit. Hover
  // still pauses without tearing the timer down (a mouse leaving mid-cycle should not reset it).
  useVisibleInterval(
    () => { if (!hoveredRef.current) setI((n) => (n + 1) % favorites.length); },
    advancing ? 6000 : null,
    elRef,
  );

  if (favorites.length === 0) return <div className="fav-empty-card">Star a scene to keep it here.</div>;
  const s = favorites[Math.min(i, favorites.length - 1)]!;
  const tone = accentVars(s.accent ?? "var(--accent)") as CSSProperties;
  return (
    <div ref={(el) => { elRef.current = el; }} className="fav-carousel" onMouseEnter={() => { hoveredRef.current = true; }} onMouseLeave={() => { hoveredRef.current = false; }}>
      <div className="fav-slide">
        <button type="button" className="fav-card" style={tone} onClick={() => onOpen(s.id)}>
          <div className="fav-art">
            <SceneArt ctx={ctx} chatId={s.id} characterId={s.cast.character.id} snapshotVersion={s.snapshotVersion} hasArt={s.hasPortrait} name={s.characterName} />
            <div className="fav-ov">
              <div className="fav-who"><span className="fav-av">{s.characterName.charAt(0).toUpperCase()}</span><b>{s.characterName}</b><i>{sinceShort(s.updatedAt, Date.now())}</i></div>
              <div className="fav-title">{s.title}</div>
            </div>
          </div>
        </button>
        <div className="fav-stat">{s.messageCount} {s.messageCount === 1 ? "msg" : "msgs"}{s.takeCount > 1 ? ` · ${s.takeCount} takes` : ""}</div>
        <button type="button" className="fav-continue" onClick={() => onOpen(s.id)}>Continue Story</button>
      </div>
      {favorites.length > 1 && (
        <div className="fav-nav">
          <button type="button" className="fav-arrow prev" aria-label="Previous favorite" onClick={() => setI((n) => (n - 1 + favorites.length) % favorites.length)}>&lsaquo;</button>
          <FavoriteDots favorites={favorites} selected={i} onSelect={setI} />
          <button type="button" className="fav-arrow next" aria-label="Next favorite" onClick={() => setI((n) => (n + 1) % favorites.length)}>&rsaquo;</button>
        </div>
      )}
    </div>
  );
}

function FavoriteDots({ favorites, selected, onSelect }: { favorites: readonly SceneSummary[]; selected: number; onSelect(index: number): void }): JSX.Element {
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(favorites, "favorite-dot", (favorite) => favorite.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const flatIndex = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndex, useCallback((index: number) => index, []),
    useCallback((index: number) => rowKeys[index], [rowKeys]), rowIndex);
  const virtualizer = useVirtualRows({ mode: "list", count: favorites.length, getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rowKeys[index]!, estimateSize: () => 11, gap: 5, horizontal: true,
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]), initialRect: { width: 140, height: 12 } });
  useEffect(() => { virtualizer.scrollToIndex(selected, { align: "auto" }); }, [selected, virtualizer]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = flatIndex(document.activeElement as HTMLElement);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event, virtualizer, favorites.length, index, event.currentTarget, (i) => rowKeys[i]!);
  };
  return <div className="fav-dots" ref={scrollRef} onFocus={onFocus} onKeyDown={onKeyDown}>
    <div className="fav-dot-space" style={{ width: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => {
        const favorite = favorites[item.index]!;
        return <button type="button" key={rowKeys[item.index]} data-pick={rowKeys[item.index]} ref={virtualizer.measureElement} data-index={item.index}
          className={`fav-dot${item.index === selected ? " on" : ""}`} style={{ transform: `translateX(${String(item.start)}px)` }}
          aria-label={`Show ${favorite.title}`} aria-current={item.index === selected} onClick={() => onSelect(item.index)} />;
      })}
    </div>
  </div>;
}

function RecentRow({ ctx, s, focusKey, onOpen }: { ctx: AppContext; s: SceneSummary; focusKey: string; onOpen(): void }): JSX.Element {
  const accentVars = useAccentVars();
  const tone = accentVars(s.accent ?? "var(--accent)") as CSSProperties;
  return (
    <button type="button" data-pick={focusKey} className="rec" style={tone} onClick={onOpen}>
      <span className="rec-art"><SceneArt ctx={ctx} chatId={s.id} characterId={s.cast.character.id} snapshotVersion={s.snapshotVersion} hasArt={s.hasPortrait} name={s.characterName} /></span>
      <span className="rec-tx"><b>{s.title}</b><small>{s.characterName}</small></span>
      {s.takeCount > 1 && <span className="rec-pip" />}
      <time>{sinceShort(s.updatedAt, Date.now())}</time>
    </button>
  );
}

function GoneRow({ g, focusKey, onRestore }: { g: SceneGrave; focusKey: string; onRestore(): void }): JSX.Element {
  return (
    <div className="rec gone" data-pick={focusKey}>
      <span className="rec-av">{g.of.charAt(0).toUpperCase()}</span>
      <span className="rec-tx"><b>{g.name}</b><small>{g.of}</small></span>
      <time>{daysLeft(g.deletedAt, Date.now())}</time>
      <button type="button" className="rs" onClick={onRestore}>Restore</button>
    </div>
  );
}

function CastTileButton({ ctx, t, focusKey, on, onSelect }: { ctx: AppContext; t: CastTile; focusKey: string; on: boolean; onSelect(): void }): JSX.Element {
  const accentVars = useAccentVars();
  const tone = accentVars(t.accent ?? "var(--accent)") as CSSProperties;
  return (
    <button type="button" data-pick={focusKey} className={`cr-tile${on ? " on" : ""}`} style={tone} onClick={onSelect}>
      <span className="cr-art"><SceneArt ctx={ctx} chatId={t.latestSceneId} characterId={t.characterId} snapshotVersion={t.snapshotVersion} hasArt={t.hasPortrait} name={t.name} /></span>
      {t.playing && <span className="cr-playing" title="Now playing"><Ic name="lucide:play" size={10} /></span>}
      <span className="cr-tip"><b>{t.name}</b><span>{t.count} {t.count === 1 ? "scene" : "scenes"}</span></span>
    </button>
  );
}

type RecentItem = { kind: "label"; key: string; text: string } | { kind: "scene"; key: string; scene: SceneSummary } | { kind: "gone"; key: string; grave: SceneGrave };

function RecentWindow({ ctx, thisWeek, earlier, cut, onOpen, onRestore }: {
  ctx: AppContext;
  thisWeek: readonly SceneSummary[]; earlier: readonly SceneSummary[]; cut: readonly SceneGrave[];
  onOpen(id: string): void; onRestore(g: SceneGrave): void;
}): JSX.Element | null {
  const rows = useMemo<RecentItem[]>(() => [
    ...(thisWeek.length ? [{ kind: "label" as const, key: "week", text: "This Week" }, ...thisWeek.map((scene): RecentItem => ({ kind: "scene", key: scene.id, scene }))] : []),
    ...(earlier.length ? [{ kind: "label" as const, key: "earlier", text: "Earlier" }, ...earlier.map((scene): RecentItem => ({ kind: "scene", key: scene.id, scene }))] : []),
    ...(cut.length ? [{ kind: "label" as const, key: "cut", text: "Cut, back for 3 days" }, ...cut.map((grave): RecentItem => ({ kind: "gone", key: grave.id, grave }))] : []),
  ], [thisWeek, earlier, cut]);
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(rows, "scene-recent", (row) => `${row.kind}:${row.key}`, (row) => row.kind === "scene" ? row.scene : row.kind === "gone" ? row.grave : row);
  const focusableRows = useMemo(() => rows.flatMap((row, index) => row.kind === "label" ? [] : [{ row, index }]), [rows]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const flatIndex = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndex, useCallback((index: number) => index, []),
    useCallback((index: number) => rowKeys[index], [rowKeys]), rowIndex);
  const virtualizer = useVirtualRows({ mode: "variable", count: rows.length, getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rowKeys[index]!, estimateSize: (index) => rows[index]!.kind === "label" ? 34 : 48,
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]), initialRect: FALLBACK_VIEWPORT });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const id = document.activeElement?.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    const index = focusableRows.findIndex(({ index }) => rowKeys[index] === id);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event, {
      scrollToIndex: (i, options) => virtualizer.scrollToIndex(focusableRows[i]!.index, options),
    }, focusableRows.length, index, event.currentTarget, (i) => rowKeys[focusableRows[i]!.index]!);
  };
  if (!rows.length) return null;
  return <div className="recent-window" ref={scrollRef} onFocus={onFocus} onKeyDown={onKeyDown}>
    <div className="recent-space" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index]!;
        return <div key={rowKeys[item.index]} className="recent-row" data-pick={row.kind === "label" ? undefined : rowKeys[item.index]} data-index={item.index} ref={virtualizer.measureElement} style={{ transform: `translateY(${String(item.start)}px)` }}>
          {row.kind === "label" ? <div className={`lab${row.key === "cut" ? " gonelab" : ""}`}><span className="sq" />{row.text}</div>
            : row.kind === "scene" ? <RecentRow ctx={ctx} s={row.scene} focusKey={rowKeys[item.index]!} onOpen={() => onOpen(row.scene.id)} />
              : <GoneRow g={row.grave} focusKey={rowKeys[item.index]!} onRestore={() => onRestore(row.grave)} />}
        </div>;
      })}
    </div>
  </div>;
}

function CastRailList({ ctx, tiles, rail, onSelect }: { ctx: AppContext; tiles: readonly CastTile[]; rail: RailSelection; onSelect(sel: RailSelection): void }): JSX.Element {
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(tiles, "scene-cast", (tile) => tile.characterId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const flatIndex = useCallback((target: HTMLElement) => {
    const id = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return id ? rowIndex(id) : -1;
  }, [rowIndex]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndex, useCallback((index: number) => index, []),
    useCallback((index: number) => rowKeys[index], [rowKeys]), rowIndex);
  const virtualizer = useVirtualRows({ mode: "list", count: tiles.length, getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rowKeys[index]!, estimateSize: () => 48, gap: 8,
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]), initialRect: FALLBACK_VIEWPORT });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = flatIndex(document.activeElement as HTMLElement);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event, virtualizer, tiles.length, index, event.currentTarget, (i) => rowKeys[i]!);
  };
  const visible = virtualizer.getVirtualItems();
  return <div className="cr-list" ref={scrollRef} onFocus={onFocus} onKeyDown={onKeyDown}>
    <div className="cr-space" style={{ height: virtualizer.getTotalSize() }}>
      {visible.map((item) => {
        const tile = tiles[item.index]!;
        return <div key={rowKeys[item.index]} className="cr-row" data-index={item.index} ref={virtualizer.measureElement} style={{ transform: `translateY(${String(item.start)}px)` }}>
          <CastTileButton ctx={ctx} t={tile} focusKey={rowKeys[item.index]!} on={rail.kind === "char" && rail.id === tile.characterId} onSelect={() => onSelect({ kind: "char", id: tile.characterId })} />
        </div>;
      })}
    </div>
  </div>;
}

function FolderRow({ ctx, f, focusKey, on, onSelect }: { ctx: AppContext; f: SceneFolder & { count: number }; focusKey: string; on: boolean; onSelect(): void }): JSX.Element {
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "scene-folder", label: f.name, data: f }));
  return (
    <button type="button" ref={menuRef} data-pick={focusKey} className={`chapter${on ? " on" : ""}`} style={{ "--c": folderTint(f.id) } as CSSProperties} onClick={onSelect}>
      <span className="ch-dot" /><span className="ch-name">{f.name}</span><span className="ch-count">{f.count}</span>
    </button>
  );
}

function FolderList({ ctx, folders, rail, onSelect }: { ctx: AppContext; folders: readonly (SceneFolder & { count: number })[]; rail: RailSelection; onSelect(sel: RailSelection): void }): JSX.Element {
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(folders, "scene-folder", (folder) => folder.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const flatIndex = useCallback((target: HTMLElement) => {
    const id = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return id ? rowIndex(id) : -1;
  }, [rowIndex]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndex, useCallback((index: number) => index, []),
    useCallback((index: number) => rowKeys[index], [rowKeys]), rowIndex);
  const virtualizer = useVirtualRows({ mode: "list", count: folders.length, getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rowKeys[index]!, estimateSize: () => 36,
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]), initialRect: FALLBACK_VIEWPORT });
  useEffect(() => {
    const index = rail.kind === "folder" ? folders.findIndex((folder) => folder.id === rail.id) : -1;
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" });
  }, [folders, rail, virtualizer]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = flatIndex(document.activeElement as HTMLElement);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event, virtualizer, folders.length, index, event.currentTarget, (i) => rowKeys[i]!);
  };
  return <div className="folder-list" ref={scrollRef} onFocus={onFocus} onKeyDown={onKeyDown}>
    <div className="folder-space" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => {
        const folder = folders[item.index]!;
        return <div key={rowKeys[item.index]} className="folder-row" data-index={item.index} ref={virtualizer.measureElement} style={{ transform: `translateY(${String(item.start)}px)` }}>
          <FolderRow ctx={ctx} f={folder} focusKey={rowKeys[item.index]!} on={rail.kind === "folder" && rail.id === folder.id} onSelect={() => onSelect({ kind: "folder", id: folder.id })} />
        </div>;
      })}
    </div>
  </div>;
}

export function ScenesSide({ ctx, scenes, cut, folders, rail, onSelect, onOpen, onRestore, onNewFolder, drawerOpen }: {
  ctx: AppContext;
  scenes: readonly SceneSummary[];
  cut: readonly SceneGrave[];
  folders: (SceneFolder & { count: number })[] | null;
  rail: RailSelection;
  onSelect(sel: RailSelection): void;
  onOpen(id: string): void;
  onRestore(g: SceneGrave): void;
  onNewFolder(): void;
  drawerOpen: boolean;
}): JSX.Element {
  const tiles = castRail(scenes);
  const favorites = fanFavorites(scenes);
  const { thisWeek, earlier } = splitByWeek(scenes, Date.now());

  return (
    <div className={`scn-side${drawerOpen ? " open" : ""}`} data-part="scenes.side">
      <aside className="char-rail">
        <button type="button" className="cr-mark" title="Scenes" onClick={() => onSelect({ kind: "all" })}>
          <Ic name="lucide:film" size={20} />
        </button>
        <div className="cr-div" />
        <button type="button" className={`cr-all${rail.kind === "all" ? " on" : ""}`} title="All Scenes" onClick={() => onSelect({ kind: "all" })}>
          <Ic name="lucide:drama" size={16} />
        </button>
        <CastRailList ctx={ctx} tiles={tiles} rail={rail} onSelect={onSelect} />
      </aside>

      <aside className="stage-panel">
        <div className="sp-top"><div className="s-act"><b>Fan Favorites</b></div></div>
        <div className="sp-scroll">
          <div className="sp-sec fav-sec"><FavCarousel ctx={ctx} favorites={favorites} onOpen={onOpen} /></div>

          {(thisWeek.length > 0 || earlier.length > 0 || cut.length > 0) && (
            <div className="sp-sec">
              <RecentWindow ctx={ctx} thisWeek={thisWeek} earlier={earlier} cut={cut} onOpen={onOpen} onRestore={onRestore} />
            </div>
          )}

          <div className="sp-sec">
            <div className="lab"><span className="sq" />Smart Folders</div>
            <button type="button" className={`chapter smart${rail.kind === "smart" ? " on" : ""}`} onClick={() => onSelect({ kind: "smart" })}>
              <Ic name="lucide:git-branch" size={14} /><span className="ch-name">Longest Stories</span><span className="ch-count">{scenes.length}</span>
            </button>
          </div>

          <div className="sp-sec">
            <div className="lab"><span className="sq" />Folders</div>
            <FolderList ctx={ctx} folders={folders ?? []} rail={rail} onSelect={onSelect} />
            <button type="button" className="newchapter" onClick={onNewFolder}><Ic name="lucide:plus" size={14} />New Folder&hellip;</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
