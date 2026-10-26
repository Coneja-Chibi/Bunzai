/**
 * The Scenes list: the gamified wireframe (design/wireframes/soft/scenes-game.html) -
 * the cast rail and stage panel (scenes-side.tsx), the "Continue your story" hero and its preview
 * (scenes-hero.tsx), and the card grid (scenes-cards.tsx), composed here with the page's state, data
 * loading, dialogs, and the shell's one context-menu system. Every feature the plain list had stays:
 * Select and bulk delete, search, the time/order filters, rename, cut to the Trash with the Cutting
 * Room dialog, the cut list with Restore, the Trash button, the load-error state, and the empty
 * state. No tabs: Bunraku has no group scenes.
 */
import { useCallback, useEffect, useState, type CSSProperties, type JSX } from "react";
import { ThemeSlot } from "../../_shared/theme-slot";
import type { AppContext } from "../../app-contract";
import { Ic } from "../../_shared/ic";
import { LIBRARY_APP, libraryTrash } from "../../_shared/scene-handoff";
import { toErrorMessage } from "../../_shared/error-message";
import type { Chat, SceneFolder } from "../../../stage/contracts/chat-store";
import type { SceneGrave, SceneSummary } from "../../../studio/scenes";
import { CutSceneDialog, DeleteFolderDialog, FolderNameDialog, MoveToFolderDialog, RenameSceneDialog } from "./scenes-dialogs";
import { SceneGrid, NewStoryCard } from "./scenes-cards";
import { SceneHero } from "./scenes-hero";
import "./variant-styles";
import { useSurfaceVariant } from "../../_shared/surface-variant";
import jewelRoom from "../../_shared/jewel-room.module.css";
import { ScenesSide, type RailSelection } from "./scenes-side";
import { useSummarySearch } from "./use-summary-search";
import { fanFavorites, filterScenes, folderTint, shownScenes, sortScenes, type CharSort, type Period, type SceneOrder } from "./scenes-core";
import { plural } from "../../../core/text";
import { Button, Chip, Segmented } from "../../components/button";

const TONE = { "--t": "var(--accent)" } as CSSProperties;
const PERIODS: [Period, string][] = [["all", "All Time"], ["week", "Week"], ["month", "Month"], ["year", "Year"]];
const ORDERS: [SceneOrder, string][] = [["recent", "Recent"], ["messages", "Messages"]];
const CHAR_SORTS: [CharSort, string][] = [["recent", "Recent"], ["az", "A-Z"], ["messages", "Messages"]];
const initial = (name: string): string => name.trim().charAt(0).toUpperCase() || "?";
type Folder = SceneFolder & { count: number };

/**
 * A scene as the server now stands, after a change: `renameScene`/`setSceneFavorite`/
 * `setSceneFolder` all answer the full `Chat`, never a `SceneSummary` (the summary's derived fields
 * - characterName, messageCount, takeCount, activeTake, accent - come from a heavier read
 * `listScenes` already paid for, and no single-scene write recomputes them). This keeps those
 * derived fields as they were and applies only what the write actually confirmed.
 *
 * `favoredAt`/`folderId` are assigned explicitly rather than left to the `...chat` spread: both are
 * optional Chat fields, so a Chat that now CARRIES NEITHER (unstarred, moved out of every folder)
 * simply omits the key, and `{...s, ...chat}` would then leave the summary's stale prior value in
 * place instead of clearing it.
 */
const applyChat = (s: SceneSummary, chat: Chat): SceneSummary => ({ ...s, ...chat, favoredAt: chat.favoredAt, folderId: chat.folderId });

export function ScenesList({ ctx, onOpen }: { ctx: AppContext; onOpen(id: string): void }): JSX.Element {
  const { api, menus, setStatus } = ctx;
  const [scenes, setScenes] = useState<SceneSummary[] | null>(null);
  const [cut, setCut] = useState<SceneGrave[]>([]);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("all");
  const [order, setOrder] = useState<SceneOrder>("recent");
  const listVariant = useSurfaceVariant("scenes.list");
  const rowStyle = listVariant === "save-file-slots" || listVariant === "chat-list" || listVariant === "table-of-contents" ? listVariant : undefined;
  // a theme's row style opens the list on the List layout; the person's own Pictures/List choice wins
  const [chosenView, setView] = useState<"cards" | "list" | null>(() => { const saved = ctx.prefs.get("scenes.view"); return saved === "list" || saved === "cards" ? saved : null; });
  const view = chosenView ?? (rowStyle ? "list" : "cards");
  const [query, setQuery] = useState("");
  const summaryHits = useSummarySearch(api.searchSceneSummaries, query);
  const [rail, setRail] = useState<RailSelection>({ kind: "all" });
  const [charSort, setCharSort] = useState<CharSort>("recent");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [cutting, setCutting] = useState<SceneSummary[] | null>(null);
  const [renaming, setRenaming] = useState<SceneSummary | null>(null);
  const [movingFolder, setMovingFolder] = useState<SceneSummary | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);

  const load = useCallback(() => {
    setProblem(null);
    api.listScenes().then(setScenes, (e: unknown) => setProblem(toErrorMessage(e)));
    api.listSceneTrash().then((g) => setCut(g.filter((x) => x.kind === "scene")), () => setCut([]));
    api.listSceneFolders().then(setFolders, () => setFolders([]));
  }, [api]);
  useEffect(load, [load]);

  const toggleFavorite = useCallback(async (s: SceneSummary): Promise<void> => {
    try {
      const chat = await api.setSceneFavorite(s.id, s.favoredAt === undefined);
      setScenes((prev) => prev && prev.map((x) => (x.id === s.id ? applyChat(x, chat) : x)));
    } catch (e) {
      setStatus(`could not update Fan Favorites: ${toErrorMessage(e)}`);
    }
    load();
  }, [api, load, setStatus]);

  useEffect(() => menus.register("scene", (t) => {
    const s = t.data as SceneSummary;
    const favored = s.favoredAt !== undefined;
    return [
      { label: "Rename Scene", onPick: () => setRenaming(s) },
      { label: favored ? "Remove from Fan Favorites" : "Add to Fan Favorites", onPick: () => void toggleFavorite(s) },
      { label: "Move to folder", onPick: () => setMovingFolder(s) },
      { label: "Delete Story", danger: true, onPick: () => setCutting([s]) },
    ];
  }), [menus, toggleFavorite]);
  useEffect(() => menus.register("scene-folder", (t) => {
    const f = t.data as Folder;
    return [
      { label: "Rename Folder", onPick: () => setRenamingFolder(f) },
      { label: "Delete Folder", danger: true, onPick: () => setDeletingFolder(f) },
    ];
  }), [menus]);

  const cutScenes = async (list: SceneSummary[]): Promise<void> => {
    setCutting(null);
    setPicked(null);
    const removed = new Set<string>();
    try {
      for (const s of list) if ((await api.deleteScene(s.id)).deleted) removed.add(s.id);
      setStatus(removed.size === 1 && list.length === 1 ? `cut "${list[0]!.title}"` : `cut ${removed.size} of ${list.length} stories`);
    } catch (e) {
      setStatus(`could not cut: ${toErrorMessage(e)}`);
    } finally {
      // Whatever the server actually confirmed, even a partial run that threw partway through -
      // never a scene the server rejected or never got to.
      if (removed.size > 0) setScenes((prev) => prev && prev.filter((s) => !removed.has(s.id)));
    }
    load();
  };
  const restore = async (g: SceneGrave): Promise<void> => {
    try {
      await api.restoreSceneGrave("scene", g.id);
      setStatus(`"${g.name}" is back on your stage`);
    } catch (e) {
      setStatus(`could not restore: ${toErrorMessage(e)}`);
    }
    load();
  };
  const openTrash = (): void => { libraryTrash.give("open"); ctx.openApp(LIBRARY_APP); };
  const rename = async (s: SceneSummary, title: string): Promise<void> => {
    setRenaming(null);
    const trimmed = title.trim();
    try {
      if (trimmed && trimmed !== s.title) {
        const chat = await api.renameScene(s.id, trimmed);
        setScenes((prev) => prev && prev.map((x) => (x.id === s.id ? applyChat(x, chat) : x)));
      }
    } catch (e) {
      setStatus(`could not rename: ${toErrorMessage(e)}`);
    }
    load();
  };
  const moveScene = async (folderId: string | null): Promise<void> => {
    const s = movingFolder;
    setMovingFolder(null);
    if (!s) return;
    try {
      const chat = await api.setSceneFolder(s.id, folderId);
      setScenes((prev) => prev && prev.map((x) => (x.id === s.id ? applyChat(x, chat) : x)));
    } catch (e) {
      setStatus(`could not move that story: ${toErrorMessage(e)}`);
    }
    load();
  };
  const createFolder = async (name: string): Promise<void> => {
    setNewFolder(false);
    try {
      await api.createSceneFolder(name);
    } catch (e) {
      setStatus(`could not make that folder: ${toErrorMessage(e)}`);
    }
    load();
  };
  const doRenameFolder = async (name: string): Promise<void> => {
    const f = renamingFolder;
    setRenamingFolder(null);
    if (!f) return;
    try {
      await api.renameSceneFolder(f.id, name);
    } catch (e) {
      setStatus(`could not rename that folder: ${toErrorMessage(e)}`);
    }
    load();
  };
  const doDeleteFolder = async (): Promise<void> => {
    const f = deletingFolder;
    setDeletingFolder(null);
    if (!f) return;
    try {
      await api.deleteSceneFolder(f.id);
    } catch (e) {
      setStatus(`could not delete that folder: ${toErrorMessage(e)}`);
    }
    if (rail.kind === "folder" && rail.id === f.id) setRail({ kind: "all" });
    load();
  };
  const startNew = async (characterId: string): Promise<void> => {
    try {
      const chat = await api.startScene(characterId);
      onOpen(chat.id);
    } catch (e) {
      setStatus(`could not start a new scene: ${toErrorMessage(e)}`);
    }
  };
  const pick = (s: SceneSummary): void => {
    if (!picked) return onOpen(s.id);
    const next = new Set(picked);
    if (!next.delete(s.id)) next.add(s.id);
    setPicked(next);
  };
  const select = (sel: RailSelection): void => { setRail(sel); setDrawerOpen(false); };

  if (problem) {
    return (
      <div className="scn"><main className="main"><div className="empty"><b>Scenes are unavailable</b><p>{problem}</p>
        <Button onClick={load}>Try again</Button></div></main></div>
    );
  }

  const all = scenes ?? [];
  const characters = new Set(all.map((s) => s.cast.character.id)).size;
  const q = query.trim().toLowerCase();
  const smart = rail.kind === "smart";
  const smartBase = smart ? filterScenes(all, { smart: "longest" }) : shownScenes(all, { period, order, query, now: Date.now(), alsoIds: summaryHits.ids });
  const shown = smart && q ? smartBase.filter((s) => s.title.toLowerCase().includes(q) || s.characterName.toLowerCase().includes(q) || summaryHits.ids.has(s.id)) : smartBase;
  const hero = (rail.kind === "all" || rail.kind === "smart") ? shown[0] : undefined;

  const charScenes = rail.kind === "char" ? sortScenes(filterScenes(all, { character: rail.id }), charSort) : [];
  const charName = rail.kind === "char" ? (charScenes[0]?.characterName ?? all.find((s) => s.cast.character.id === rail.id)?.characterName ?? "") : "";
  const folder = rail.kind === "folder" ? (folders ?? []).find((f) => f.id === rail.id) : undefined;
  const folderScenes = rail.kind === "folder" ? filterScenes(all, { folder: rail.id }) : [];

  return (
    <div className={`scn ${jewelRoom.room}`} data-part="scenes.root">
      <ScenesSide ctx={ctx} scenes={all} cut={cut} folders={folders} rail={rail} onSelect={select}
        onOpen={onOpen} onRestore={(g) => void restore(g)} onNewFolder={() => setNewFolder(true)} drawerOpen={drawerOpen} />
      <main className="main" data-part="scenes.main">
        <Button size="sm" icon="lucide:drama" onClick={() => setDrawerOpen(!drawerOpen)} aria-label="Cast and chapters">Cast</Button>

        {rail.kind === "char" && (
          <div className="charroot">
            <Button variant="quiet" size="sm" icon="lucide:chevron-left" onClick={() => select({ kind: "all" })}>All scenes</Button>
            <div className="charhead">
              <span className="ch-avatar" style={TONE}>{initial(charName)}</span>
              <div><span className="s-act"><b>Starring</b></span><h1>{charName}</h1><p>{charScenes.length} {charScenes.length === 1 ? "scene" : "scenes"} played</p></div>
              <div className="sortpills"><span>Sort:</span><Segmented label="Sort" size="sm" items={CHAR_SORTS.map(([value, label]) => ({ value, label }))} value={charSort} onChange={setCharSort} /></div>
            </div>
            <SceneGrid ctx={ctx} scenes={charScenes} picked={picked} onPick={pick} layout={view} groupByTime={charSort === "recent"}>
              <NewStoryCard characterName={charName} onStart={() => void startNew(rail.id)} />
            </SceneGrid>
          </div>
        )}

        {rail.kind === "folder" && folder && (
          <div className="folderroot">
            <Button variant="quiet" size="sm" icon="lucide:chevron-left" onClick={() => select({ kind: "all" })}>All scenes</Button>
            <div className="folderhead">
              <span className="ch-dot big" style={{ background: folderTint(folder.id) }} />
              <div><span className="s-act"><b>Chapter</b></span><h1>{folder.name}</h1><p>{folderScenes.length} {folderScenes.length === 1 ? "story" : "stories"} in this chapter</p></div>
            </div>
            <SceneGrid ctx={ctx} scenes={folderScenes} picked={picked} onPick={pick} layout={view} />
          </div>
        )}

        {(rail.kind === "all" || rail.kind === "smart") && (
          <>
            <header className="plaque" data-part="scenes.header">
              <div>
                <div className="s-act"><b>Your Stage</b></div>
                <h1 className="s-title">Scenes</h1>
                <p className="s-lede">{scenes ? `${plural(scenes.length, "story", "stories")} across ${plural(characters, "character")}` : "Loading..."}</p>
              </div>
              <div className="plaque-actions">
                <Segmented label="Scene layout" items={[{ value: "cards", label: "Pictures" }, { value: "list", label: "List" }]} value={view}
                  onChange={(layout) => { setView(layout); ctx.prefs.set("scenes.view", layout); }} />
                <Chip pressed={picked !== null} onClick={() => setPicked(picked ? null : new Set())}><Ic name="lucide:square-check-big" size={16} />Select</Chip>
                <Button variant="quiet" size="sm" icon="lucide:trash-2" onClick={openTrash}>Trash{cut.length > 0 ? ` ${cut.length}` : ""}</Button>
                <label className="search"><Ic name="lucide:search" size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." aria-label="Search scenes" /></label>
              </div>
            </header>
            <ThemeSlot id="scenes.header" />
            {picked && (
              <div className="selbar">
                {picked.size} {picked.size === 1 ? "scene" : "scenes"} selected
                {picked.size > 0 && <Button variant="danger" size="sm" onClick={() => setCutting(all.filter((s) => picked.has(s.id)))}>Delete {picked.size}</Button>}
                <Button variant="quiet" size="sm" onClick={() => setPicked(null)}>Cancel</Button>
              </div>
            )}
            {summaryHits.failed && <p className="sumfail" role="status">Summaries could not be searched. Titles and characters still match.</p>}
            {scenes && scenes.length > 0 && !smart && (
              <div className="filters" data-part="scenes.filters">
                <Segmented label="Period" size="sm" items={PERIODS.map(([value, label]) => ({ value, label }))} value={period} onChange={setPeriod} />
                <Segmented label="Order" size="sm" items={ORDERS.map(([value, label]) => ({ value, label }))} value={order} onChange={setOrder} />
              </div>
            )}
            {scenes && scenes.length === 0 && (
              <div className="emptyroot" data-part="scenes.empty">
                <div className="mark"><Ic name="lucide:drama" size={32} /></div>
                <b>Your stage is empty</b>
                <p>Discover a character in the Library and start your first scene. Every scene you play shows up here, gathered by cast member and chapter.</p>
                <Button variant="primary" onClick={() => ctx.openApp(LIBRARY_APP)}>Discover Characters</Button>
              </div>
            )}
            {q && shown.length === 0 && (rail.kind === "all" || rail.kind === "smart") && (
              <div className="emptyroot" data-part="scenes.nomatch" data-empty>
                <div className="mark"><Ic name="lucide:search" size={32} /></div>
                <b>Nothing matches {JSON.stringify(query.trim())}</b>
                <p>Search checks scene titles, character names and chat summaries, within the period shown. Clear the search to see every scene again.</p>
                <Button onClick={() => setQuery("")}>Clear search</Button>
              </div>
            )}
            {hero && <SceneHero key={hero.id} ctx={ctx} scene={hero} picked={picked ? picked.has(hero.id) : undefined} onOpen={() => (picked ? pick(hero) : onOpen(hero.id))} />}
            {all.some((s) => s.favoredAt !== undefined) && <section className="favorites-shelf"><h2>Fan Favorites</h2>
              <SceneGrid ctx={ctx} scenes={fanFavorites(all)} picked={picked} onPick={pick} />
            </section>}
            <SceneGrid ctx={ctx} scenes={shown} excludeId={hero?.id} picked={picked} onPick={pick} layout={view} groupByTime={order === "recent" && !smart} />
          </>
        )}
      </main>

      {cutting && <CutSceneDialog scenes={cutting} onCancel={() => setCutting(null)} onCut={() => void cutScenes(cutting)} />}
      {renaming && <RenameSceneDialog title={renaming.title} onCancel={() => setRenaming(null)} onSave={(t) => void rename(renaming, t)} />}
      {movingFolder && <MoveToFolderDialog scene={movingFolder} folders={folders ?? []} onCancel={() => setMovingFolder(null)} onPick={(id) => void moveScene(id)} />}
      {newFolder && <FolderNameDialog mode="new" initial="" onCancel={() => setNewFolder(false)} onSave={(n) => void createFolder(n)} />}
      {renamingFolder && <FolderNameDialog mode="rename" initial={renamingFolder.name} onCancel={() => setRenamingFolder(null)} onSave={(n) => void doRenameFolder(n)} />}
      {deletingFolder && <DeleteFolderDialog name={deletingFolder.name} onCancel={() => setDeletingFolder(null)} onDelete={() => void doDeleteFolder()} />}
    </div>
  );
}
