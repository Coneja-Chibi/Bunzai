/**
 * The Messenger's Lorebooks panel (approved wireframe messenger-discord/panels.html section 3): the entries list, the book manager behind the header's sliders button and the entry
 * inspector, one program with three views. Every read and write comes from `useLoreWing`, the hook the Full Chat Lorebook wing runs on (scene-lore-wing.tsx), so the book load, the save
 * queue (one per book), the 409 reload and the scene's own book choice are the same code in both layouts. The list shows the entries of every book that is on, each under its own header;
 * the panel tells the wing which books to keep loaded, and opening an entry makes its book the open one for the inspector.
 */
import { useEffect, useMemo, type JSX } from "react";
import type { Chat } from "../../../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../../../app-contract";
import type { SceneLoreBook } from "../../../../../app-contract-scenes";
import { Button } from "../../../../../components/button";
import { useLoreWing } from "../../../scene-lore-wing";
import { LoreBooks } from "./lore-books";
import { LoreInspector } from "./lore-inspector";
import { LoreList } from "./lore-list";

export type LoreApi = ReturnType<typeof useLoreWing>;

export function LorePanel({ ctx, chat, characterName, onLore }: { ctx: AppContext; chat: Chat; characterName: string; onLore(books: SceneLoreBook[] | null): void }): JSX.Element {
  const w = useLoreWing(ctx, chat, onLore);
  const { lore, books, picking, selectedBookId, retain } = w;
  const activeKey = books.filter((b) => b.enabled && !b.missing).map((b) => b.id).join(",");
  const active = useMemo(() => (activeKey ? activeKey.split(",") : []), [activeKey]);
  useEffect(() => { retain(active); }, [retain, active]);
  const shown = books.find((b) => b.id === selectedBookId && !b.missing) ?? null;
  const entry = w.entries?.find((e) => e.id === w.selectedEntryId) ?? null;
  const view = lore.state !== "ready" ? "wait" : picking !== "none" ? "books" : shown && entry && w.bookLoaded.state === "ready" ? "entry" : "list";
  let body: JSX.Element;
  if (lore.state === "loading") body = <div className="msn-lore-empty" role="status">Loading the scene&apos;s lorebooks...</div>;
  else if (lore.state === "failed") body = <div className="msn-lore-empty" role="alert"><b>Could not load lorebooks</b>{lore.why}<Button size="sm" onClick={() => void w.loadLore()}>Try again</Button></div>;
  else if (view === "books") body = <LoreBooks w={w} characterName={characterName} />;
  else if (view === "entry" && shown && entry) body = <LoreInspector w={w} book={shown} entry={entry} />;
  else body = <LoreList w={w} />;
  return <div className="wl msn-lore" data-part="scene.messenger.lore" data-view={view}>{body}</div>;
}
