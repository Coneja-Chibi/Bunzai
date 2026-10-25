/**
 * The World wing's Compendium tab (RoleCall `CompendiumWingPanel`): the shell, the book the tabs read, and the tab bodies.
 * It reads one book once (use-compendium-book.ts) and writes nothing: opening it changes no chat setting, no book and no
 * preference (04b R4; RoleCall seeds chat config on open, F9). The Activity and Settings tabs are other tracks': `activity`
 * and `settings` are render props the scene page fills (mount ids `compendium.activity`, `compendium.settings`), `headerActions`
 * is where the Dashboard draws Reconcile (`compendium.headerActions`), `chip` replaces the read-only access chip, and
 * `recentWrites` is what the receipts say was written. Without them each says it is not built yet.
 */
import { useMemo, useState, type JSX, type ReactNode } from "react";
import type { AppContext } from "../../../app-contract";
import type { SceneLoreBook } from "../../../app-contract-scenes";
import type { Chat } from "../../../../stage/contracts/chat-store";
import { accessOf, flagsOf } from "../../../../core/compendium";
import type { TreeUi } from "./browse/catalogue";
import { firstBookId, withTree } from "./compendium-core";
import { BookBar, Hero, TabStrip, type TabId } from "./compendium-shell";
import { useCompendiumBook } from "./use-compendium-book";
import { useCompendiumTree } from "./use-compendium-tree";
import { useTreeChoices } from "./use-tree-choices";
import { TreeMaintenance } from "./tabs/tree-maintenance";
import { Dashboard } from "./tabs/dashboard";
import { Browse, type BrowseState } from "./tabs/browse";
import { Storyboards } from "./tabs/storyboards";
import { pendingStoryboards } from "./storyboards/storyboards-open";
import type { RecentWrite } from "./cells/cells-lists";
import type { BookModel } from "./compendium-core";

export interface MountContext { bookId: string; bookName: string }
export interface CompendiumWingProps {
  ctx: AppContext;
  chat: Chat;
  /** The scene's books as the Lorebook tab reports them; null until they load. */
  books: readonly SceneLoreBook[] | null;
  activity?(m: MountContext): ReactNode;
  settings?(m: MountContext): ReactNode;
  /** Draws between the tab row and the body on every tab: the lock notice while a book's edits are paused. */
  notice?(m: MountContext): ReactNode;
  /** Draws on the Dashboard under its header: the Standardize banner and its run cards. Gets the open book's model. */
  banner?(m: MountContext & { model: BookModel }): ReactNode;
  /** The Dashboard's header buttons; a function gets the open book, since the page does not know which book is picked. */
  headerActions?: ReactNode | ((m: MountContext) => ReactNode);
  /** The access chip; a function gets the open book's id, since the page does not know which book is picked. */
  chip?: JSX.Element | ((bookId: string, bookName: string) => JSX.Element);
  recentWrites?: readonly RecentWrite[];
  /** Hands a changed scene back to the page (a tree build clears Reorganize flags; a Lock or Move is saved to it). Without it the tree is shown and not editable. */
  onChat?(chat: Chat): void;
}

const NOT_BUILT = (what: string, id: string): JSX.Element => <div className="cp-note" data-mount={id}>{what} is not built yet.</div>;

export function CompendiumWing({ ctx, chat, books, activity, settings, headerActions, chip, recentWrites, notice, banner, onChat }: CompendiumWingProps): JSX.Element {
  const [tab, setTab] = useState<TabId>(() => (pendingStoryboards() ? "storyboards" : "dashboard"));
  const [picked, setPicked] = useState<string | null>(null);
  const [browse, setBrowse] = useState<BrowseState>({ sub: "by-type", query: "", entryId: null });
  const usable = (books ?? []).filter((b) => !b.missing);
  const bookId = picked && usable.some((b) => b.id === picked) ? picked : firstBookId(usable);
  const read = useCompendiumBook(ctx, books === null ? null : bookId);
  const store = useCompendiumTree(ctx, chat.id, books === null ? null : bookId, onChat);
  const choices = useTreeChoices(ctx, chat, onChat ?? (() => undefined), bookId ?? "");
  const shown = useMemo(() => (read.state === "ready" && store.loaded ? withTree(read.model, store.layout, choices.constraints) : null), [read, store.loaded, store.layout, choices.constraints]);
  const treeUi: TreeUi | undefined = !onChat || !shown ? undefined : {
    flagsOf: (id) => flagsOf(choices.constraints, id),
    toggle: (kind, id, label, on) => void choices.toggle(kind, id, label, on),
    pin: (entryId, entryLabel, targetId, targetLabel) => void choices.pin(entryId, entryLabel, targetId, targetLabel),
    drop: (entryId, nodeId, nodeLabel) => {
      if (!store.layout) return ctx.setStatus("Tree not built yet - build one first");
      const name = shown.byId.get(entryId)?.name ?? "The entry";
      void store.move(entryId, nodeId).then((moved) => moved && ctx.setStatus(`"${name}" moved under "${nodeLabel}".`));
    },
  };

  if (books === null) return <div className="cp"><div className="cp-load">Loading compendium...</div></div>;
  if (bookId === null) {
    return <div className="cp"><div className="cp-none"><b>Compendium</b><p>No active lorebook to browse.</p><small>Add a lorebook to this chat to see the compendium.</small></div></div>;
  }
  const bookName = usable.find((b) => b.id === bookId)?.name ?? "";
  const open = (entryId: string): void => { setBrowse((s) => ({ ...s, entryId })); setTab("browse"); };
  const mount: MountContext = { bookId, bookName };

  const onBook = (): JSX.Element => {
    if (read.state === "loading" || read.state === "none" || !shown) return <div className="cp-load">Loading compendium...</div>;
    if (read.state === "gone") return <div className="cp-load bad">This book is not in your library.</div>;
    if (read.state === "failed") return <div className="cp-load bad">{read.why}</div>;
    const model = shown;
    return tab === "storyboards"
      ? <Storyboards ctx={ctx} chat={chat} entries={model.entries} {...(onChat ? { onChat } : {})} onOpen={open} />
      : tab === "browse"
      ? <Browse model={model} bookName={bookName} state={browse} onState={(next) => setBrowse((s) => ({ ...s, ...next }))} {...(treeUi ? { tree: treeUi } : {})} />
      : <Dashboard model={model} bookName={bookName} maintenance={<TreeMaintenance store={store} />} onOpen={open} onTree={() => { setBrowse((s) => ({ ...s, sub: "tv-tree" })); setTab("browse"); }} headerActions={typeof headerActions === "function" ? headerActions(mount) : headerActions} banner={banner?.({ ...mount, model })} recentWrites={recentWrites} />;
  };

  return (
    <div className="cp" data-part="compendium.root">
      <Hero />
      <TabStrip tab={tab} onTab={setTab} />
      <BookBar books={usable} bookId={bookId} onBook={(id) => { setPicked(id); setBrowse((s) => ({ ...s, entryId: null })); }} access={accessOf(chat.compendium, bookId)} {...(chip ? { chip: typeof chip === "function" ? chip(bookId, usable.find((b) => b.id === bookId)?.name ?? "") : chip } : {})} />
      {notice?.(mount)}
      <div className={`cp-body${tab === "browse" ? " full" : ""}`}>
        {tab === "dashboard" || tab === "browse" || tab === "storyboards" ? onBook()
          : tab === "activity" ? (activity?.(mount) ?? NOT_BUILT("Activity", "compendium.activity"))
          : (settings?.(mount) ?? NOT_BUILT("Settings", "compendium.settings"))}
      </div>
    </div>
  );
}
