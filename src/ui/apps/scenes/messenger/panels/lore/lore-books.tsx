/**
 * The Lorebooks panel's book manager (panels.html 3d), the view behind the header's sliders button: the books this scene reads (open one, switch it on or off, remove the ones this scene
 * added), the library to add from, and a new lorebook. All of it is the wing's own: `toggle`, `remove` and `pick` are `useSceneLore`'s writers (use-scene-lore.ts), the library list is
 * the wing's `LibraryPicker`, and Create is the wing's `createBook`. Remove is drawn only for a book the scene added: a book the character or persona brings can only be switched off.
 */
import { useState, type JSX } from "react";
import { Button, IconButton, ListRow, Toggle } from "../../../../../components/button";
import { LibraryPicker } from "../../../scene-lore-books";
import { sourceBadge } from "../../../lore-core";
import type { LoreApi } from "./lore-panel";

const initials = (name: string): string => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "L";

export function LoreBooks({ w, characterName }: { w: LoreApi; characterName: string }): JSX.Element {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const lastTurn = w.lore.state === "ready" ? w.lore.lastTurn : null;
  const create = (): void => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    void w.createBook(trimmed).then(() => setName("")).finally(() => setBusy(false));
  };
  return (
    <>
      <div className="msn-lore-top">
        <IconButton variant="quiet" size="sm" icon="lucide:arrow-left" label="Back to lorebooks" data-part="scene.messenger.lore.books-back" onClick={() => w.setPicking("none")} />
        <div className="t"><b>Add or remove lorebooks</b><small>This scene only</small></div>
      </div>
      <div className="msn-lore-main" data-part="scene.messenger.lore.books">
        <div className="msn-lore-sc">Active lorebooks<span className="n">{w.books.length}</span></div>
        {w.books.map((b) => {
          const fired = lastTurn ? lastTurn.fired.filter((f) => f.bookId === b.id && !f.cut).length : null;
          const sub = b.missing ? "Not in your library" : [`${b.entries} ${b.entries === 1 ? "entry" : "entries"}`, fired === null ? null : `${fired} fired last turn`, sourceBadge(b, characterName)].filter(Boolean).join(" · ");
          return (
            <div key={b.id} className="msn-lore-ar" data-part="scene.messenger.lore.book" data-off={b.enabled ? undefined : ""}>
              <Toggle size="sm" on={b.enabled} aria-label={`${b.enabled ? "Disable" : "Enable"} ${b.name}`} data-part="scene.messenger.lore.book-switch" onChange={() => w.toggle(b)} />
              <ListRow data-part="scene.messenger.lore.book-open" label={b.name} subtitle={sub} leading={<span className="av">{initials(b.name)}</span>} disabled={b.missing}
                onClick={() => { w.setPicking("none"); void w.openBook(b.id); }} />
              {b.source === "scene" && (
                <IconButton variant="quiet" size="sm" icon="lucide:x" label={`Remove ${b.name} from this scene`} data-part="scene.messenger.lore.book-remove" onClick={() => w.remove(b)} />
              )}
            </div>
          );
        })}
        {w.books.length === 0 && <div className="msn-lore-empty"><b>No lorebooks</b>With none active, entries have nothing to fire. Add one to begin.</div>}
        <div className="msn-lore-sc">Add lorebook</div>
        <LibraryPicker library={w.library} inScene={w.inScene} onPick={w.pick} />
        <div className="msn-lore-sc">New lorebook</div>
        <div className="msn-lore-new">
          <input type="text" value={name} maxLength={255} disabled={busy} placeholder="Name your new lorebook" aria-label="New lorebook name"
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }} />
          <Button variant="primary" data-part="scene.messenger.lore.book-create" disabled={busy || !name.trim()} onClick={create}>{busy ? "Creating..." : "Create"}</Button>
        </div>
      </div>
    </>
  );
}
