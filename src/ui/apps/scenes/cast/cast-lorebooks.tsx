/**
 * The Character tab's Lorebooks section (RoleCall's CharacterLorebookSection.tsx and the Open Full Editor
 * link, CharacterPanel.tsx:2249-2276). Bundled books are the ones the card links (source "character"); the
 * added ones are this scene's own choice (source "scene"). Switching a book or adding one is the scene's
 * lorebook choice (ChatStore rule 20), never an edit of the card, so it saves at once through the same
 * hook the World wing uses. RoleCall's first-time Yes or No prompt for a bundled book has no state to
 * hold here, so every bundled book is a switch. Bundling more is the card's own edit, in the full editor.
 */
import { useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { SceneLoreBook } from "../../../app-contract-scenes";
import { Ic } from "../../../_shared/ic";
import { LibraryPicker } from "../scene-lore-books";
import { useSceneLore } from "../use-scene-lore";
import { ToggleSwitch } from "../../../components/toggle-switch";

function Row({ book, children }: { book: SceneLoreBook; children: JSX.Element }): JSX.Element {
  return (
    <div className={`cw-lb${book.enabled ? "" : " off"}`}>
      <div><b>{book.missing ? `${book.name} (not in your library)` : book.name}</b><small>{book.entries} entries</small></div>
      {children}
    </div>
  );
}

function Switch({ book, onToggle }: { book: SceneLoreBook; onToggle(): void }): JSX.Element {
  return <ToggleSwitch on={book.enabled} aria-label={`Switch ${book.enabled ? "off" : "on"} ${book.name}`} onChange={onToggle} />;
}

export function LorebooksSection({ ctx, chatId, onOpenEditor }: { ctx: AppContext; chatId: string; onOpenEditor(): void }): JSX.Element {
  const { lore, toggle, remove, add } = useSceneLore(ctx, chatId);
  const [expanded, setExpanded] = useState(true);
  const [picking, setPicking] = useState(false);
  const [library, setLibrary] = useState<StudioEntitySummary[] | null>(null);
  const books = lore.state === "ready" ? lore.books : [];
  const bundled = books.filter((b) => b.source === "character");
  const added = books.filter((b) => b.source === "scene");
  const pick = (): void => {
    if (!picking) ctx.api.listEntities("lorebook").then(setLibrary, () => setLibrary([]));
    setPicking(!picking);
  };
  return (
    <>
      <section className="cw-lore" data-part="scene.cast.lorebooks">
        <button type="button" className="cw-lore-h" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          <Ic name="lucide:book" size={16} /><h3>Lorebooks</h3>
          {books.length > 0 && <small>({bundled.length} bundled{added.length > 0 ? `, ${added.length} added` : ""})</small>}
          <Ic name={expanded ? "lucide:chevron-up" : "lucide:chevron-down"} size={16} />
        </button>
        {expanded && (
          <div className="cw-lore-b">
            {lore.state === "failed" && <p className="notice gone">{lore.why}</p>}
            {lore.state === "ready" && books.length === 0 && <p className="cw-lore-none"><b>No lorebooks configured</b>Add your own lorebooks to enhance the roleplay</p>}
            {bundled.length > 0 && <p className="cw-lore-k"><Ic name="mdi:star" size={12} />Creator Recommends</p>}
            {bundled.map((b) => <Row key={b.id} book={b}><Switch book={b} onToggle={() => toggle(b)} /></Row>)}
            {added.length > 0 && <p className="cw-lore-k">Your Added Lorebooks</p>}
            {added.map((b) => (
              <Row key={b.id} book={b}>
                <span className="acts"><Switch book={b} onToggle={() => toggle(b)} />
                  <button type="button" className="rm" title="Remove from session" aria-label={`Remove ${b.name} from this scene`} onClick={() => remove(b)}><Ic name="lucide:x" size={14} /></button></span>
              </Row>
            ))}
            <button type="button" className="cw-lore-add" aria-expanded={picking} onClick={pick}><Ic name="lucide:plus" size={14} />Add Your Lorebook</button>
            {picking && <LibraryPicker library={library} inScene={new Set(books.map((b) => b.id))} onPick={(id) => { add(id); setPicking(false); }} />}
            <p className="cw-lore-man">Manage bundled lorebooks in the <button type="button" onClick={onOpenEditor}>full editor</button></p>
          </div>
        )}
      </section>
      <button type="button" className="cw-fulled" onClick={onOpenEditor}><Ic name="lucide:external-link" size={16} />Open Full Editor</button>
    </>
  );
}
