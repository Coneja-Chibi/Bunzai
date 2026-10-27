/**
 * The Compendium page's book rows (Full Chat: Compendium > Settings > "Books in this chat", compendium/tabs/settings/books.tsx): each attached book's access, the default write book, and the one click that
 * makes a book for the scene. Access writes the patch `accessChange` builds (it drops the default write book with a book that can no longer be written); the write book and the made book go through the same
 * `useSceneCompendium` patch the Settings tab uses. Per-book keyword matching is not drawn: nothing reads `ignoreKeywords`, and the Settings tab draws no control for it either.
 */
import { useRef, useState, type JSX } from "react";
import { accessOf, canWrite, writeBookOf } from "../../../../../../core/compendium/defaults";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { protect } from "../../../../../_shared/protected-control";
import { CHOICES } from "../../../compendium/tabs/settings/access-chip";
import { accessChange, makeBook } from "../../../compendium/tabs/settings/books";
import { useSceneLore } from "../../../use-scene-lore";
import { ActionRow, SelectRow } from "../../frames/settings-rows";
import type { WingArgs } from "../../wing-props";
import { useCompendiumSet } from "./compendium-env";

const SAY = "msn-st-secd";

/** One access choice per book, as in the Compendium's access chip. */
export function BookAccessRows({ a }: { a: WingArgs }): JSX.Element {
  const { ctx, chat, set } = useCompendiumSet(a);
  const { lore } = useSceneLore(ctx, chat.id);
  const books = lore.state === "ready" ? lore.books : [];
  return (
    <>
      {books.map(/* bounded-ok: the books attached to one scene, capped by MAX_BOOKS */ (b) => (
        <div key={b.id} {...protect("compendium-access")}>
          <SelectRow label={`Compendium access: ${b.name}`} description={CHOICES.find((c) => c.value === accessOf(chat.compendium, b.id))?.text ?? ""} value={accessOf(chat.compendium, b.id)} options={CHOICES.map((c) => ({ value: c.value, label: c.label }))}
            onChange={(next) => void set(accessChange(b.id, next, chat.compendium?.writeBook === b.id))} />
        </div>
      ))}
      {lore.state === "ready" && books.length === 0 && <p className={SAY}>Attach a lorebook first; the Compendium files notes into a book.</p>}
    </>
  );
}

/** The default write book (only a book that allows writes can be it) and "Make a book for this scene". */
export function WriteBookRows({ a }: { a: WingArgs }): JSX.Element {
  const { ctx, chat, compendium, set } = useCompendiumSet(a);
  const lore = useSceneLore(ctx, chat.id);
  const [making, setMaking] = useState(false);
  const busy = useRef(false);
  const books = lore.lore.state === "ready" ? lore.lore.books : [];
  const writable = books.filter((b) => canWrite(accessOf(compendium.saved, b.id)));
  const current = writeBookOf(compendium.saved) ?? "";
  const make = async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setMaking(true);
    try {
      await makeBook(ctx, chat, lore, set);
    } catch (e) {
      ctx.setStatus(`could not make a book for this scene: ${toErrorMessage(e, "the library refused it")}`);
    } finally {
      busy.current = false;
      setMaking(false);
    }
  };
  return (
    <>
      <SelectRow label="Default write book" description="Where filing writes when it does not name a book. Only a book that allows writes can be it." value={current}
        options={[{ value: "", label: "None" }, ...writable.map((b) => ({ value: b.id, label: b.name }))]} onChange={(id) => void set({ writeBook: id === "" ? null : id })} />
      <ActionRow label="Make a book for this scene" description={`Creates a library lorebook named "${chat.title} Compendium", adds it to this scene and makes it the default write book.`}
        action={making ? "Making..." : "Make book"} onAction={() => { if (lore.lore.state === "ready" && !making) void make(); }} />
    </>
  );
}
