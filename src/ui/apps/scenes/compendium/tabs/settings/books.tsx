/**
 * "Books in this chat" (RoleCall `CompendiumSettings.tsx:866-958`): a switch per book, its Access (Read and write, Read only, Write only), and
 * the default write book. Differences, on the Compendium defaults (04b section 9): a book is read only until the person grants
 * write (RoleCall defaults to read and write), the switch is Access "off", and "Make a book for this scene" is the one click that creates a
 * library lorebook "<scene> Compendium", adds it to the scene and makes it the default write book. Keyword matching is drawn with the
 * keyword pass that reads it. A book the scene switched off in the World wing is shown, and says it is not read.
 */
import { useRef, useState, type JSX } from "react";
import { Button, Chip } from "../../../../../components/button";
import { accessOf, canWrite } from "../../../../../../core/compendium/defaults";
import type { ChatCompendiumPatch, CompendiumAccess } from "../../../../../../stage/contracts/chat-store";
import type { SceneLoreBook } from "../../../../../app-contract-scenes";
import { createBlank } from "../../../../../_shared/new-piece";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { SettingsSection, SettingsSegmented, SettingsSwitch } from "./parts";
import type { SectionProps } from "./deps";

const LEVELS = [{ value: "read_write", label: "Read and write" }, { value: "read_only", label: "Read only" }, { value: "write_only", label: "Write only" }] as const;

/** One change to a book's access, dropping the default write book with it when the book can no longer be written. */
export const accessChange = (bookId: string, access: CompendiumAccess, wasDefault: boolean): ChatCompendiumPatch =>
  ({ books: { [bookId]: { access } }, ...(wasDefault && !canWrite(access) ? { writeBook: null } : {}) });

function BookCard({ book, access, isDefault, set }: { book: SceneLoreBook; access: CompendiumAccess; isDefault: boolean; set(change: ChatCompendiumPatch): Promise<void> }): JSX.Element {
  const on = access !== "off";
  return (
    <div className="cps-book">
      <div className="cps-bk">
        <span>
          <SettingsSwitch on={on} label={`Use ${book.name}`} onChange={(next) => void set(accessChange(book.id, next ? "read_only" : "off", isDefault))} />
          <b>{book.name}</b>
          <em>{book.missing ? "Not in your library" : !book.enabled ? "Switched off in the World wing" : `${book.entries} entries`}</em>
        </span>
        {on && canWrite(access) && (
          <Chip pressed={isDefault}
            title={isDefault ? "Clear the default write book" : "Use this book when a Compendium write does not name a book"}
            onClick={() => void set({ writeBook: isDefault ? null : book.id })}>{isDefault ? "Default write book · Clear" : "Make default"}</Chip>
        )}
      </div>
      {on && <SettingsSegmented label="Access" hint="Choose exactly how Compendium may use this book." value={access} options={LEVELS}
        onChange={(next) => void set(accessChange(book.id, next, isDefault))} />}
    </div>
  );
}

/** The one click that makes a library lorebook "<scene> Compendium", adds it to the scene and makes it the default write book. Rejects with the reason the library or the scene gave. */
export async function makeBook(ctx: SectionProps["ctx"], chat: SectionProps["chat"], lore: SectionProps["lore"], set: SectionProps["set"]): Promise<void> {
  const made = await createBlank(ctx, "lorebook", `${chat.title} Compendium`);
  lore.add(made.id);
  await set({ books: { [made.id]: { access: "read_write" } }, writeBook: made.id });
}

export function BooksSection({ ctx, chat, compendium, lore, set }: SectionProps): JSX.Element {
  const [making, setMaking] = useState(false);
  const busy = useRef(false);
  const books = lore.lore.state === "ready" ? lore.lore.books : [];
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
    <SettingsSection id="books" title="Books in this chat" blurb="Turn on the books Compendium may use. A book starts read only: Compendium reads it and never changes it.">
      {lore.lore.state === "loading" && <p className="cps-hint">Loading this scene&apos;s books...</p>}
      {lore.lore.state === "failed" && <p className="cps-note">{lore.lore.why}</p>}
      {lore.lore.state === "ready" && books.length === 0 && <p className="cps-hint">No lorebook is attached to this scene.</p>}
      {books.map((b) => <BookCard key={b.id} book={b} access={accessOf(compendium.saved, b.id)} isDefault={compendium.saved?.writeBook === b.id} set={set} />)}
      <div className="cps-make">
        <Button disabled={making || lore.lore.state !== "ready"} onClick={() => void make()}>Make a book for this scene</Button>
        <p className="cps-hint">Creates a library lorebook named &quot;{chat.title} Compendium&quot;, adds it to this scene and makes it the default write book.</p>
      </div>
    </SettingsSection>
  );
}
