/**
 * The Compendium's frame (RoleCall `CompendiumWingPanel.tsx:891-1205`): the hero, the tab strip (one dropdown below 512px),
 * and the book bar with its access chip. Read-only: the chip shows the book's access and nothing here changes it (the Settings
 * tab owns that, Track B); `chip` replaces it when that tab lands. The body is whatever the wing hands in.
 */
import { useState, type JSX } from "react";
import type { SceneLoreBook } from "../../../app-contract-scenes";
import { Ic, type IconName } from "../../../_shared/ic";
import { Button, ListRow, Tabs } from "../../../components/button";
import type { CompendiumAccess } from "../../../../stage/contracts/chat-settings-types";

export type TabId = "dashboard" | "browse" | "storyboards" | "activity" | "settings";
export const TABS: readonly { id: TabId; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Dashboard", icon: "lucide:layout-dashboard" },
  { id: "browse", label: "Browse", icon: "lucide:book-open-text" },
  { id: "storyboards", label: "Storyboards", icon: "lucide:panels-top-left" },
  { id: "activity", label: "Activity", icon: "lucide:activity" },
  { id: "settings", label: "Settings", icon: "lucide:settings" },
];

const ACCESS_LABEL: Record<CompendiumAccess, string> = { read_only: "Read-Only", read_write: "Read + Write", write_only: "Write-Only", off: "Disabled" };

export function Hero(): JSX.Element {
  return (
    <div className="cp-hero-w" data-part="compendium.hero">
      <header className="cp-hero">
        <span className="ico"><Ic name="mdi:book-multiple-outline" size={20} /></span>
        <div>
          <div className="eb">Living world reference</div>
          <h2>The <em>Compendium</em></h2>
          <p>Browse, curate, and standardize the lorebooks the AI reads alongside this chat: every entry, dossier, and tree at a glance.</p>
        </div>
      </header>
    </div>
  );
}

export function TabStrip({ tab, onTab }: { tab: TabId; onTab(t: TabId): void }): JSX.Element {
  return (
    <>
      <div className="cp-tabs">
        <Tabs label="Compendium sections" data-part="compendium.tabs" value={tab} onChange={onTab} items={TABS.map((t) => ({ value: t.id, label: <><Ic name={t.icon} size={14} />{t.label}</> }))} />
      </div>
      <div className="cp-tabsel"><select aria-label="Compendium section" value={tab} onChange={(e) => onTab(e.target.value as TabId)}>{TABS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
    </>
  );
}

export function BookBar({ books, bookId, onBook, access, chip }: { books: readonly SceneLoreBook[]; bookId: string; onBook(id: string): void; access: CompendiumAccess; chip?: JSX.Element }): JSX.Element {
  const [open, setOpen] = useState(false);
  const name = books.find((b) => b.id === bookId)?.name ?? "";
  const label = <><span className="lb">Compendium</span><span className="nm">{name}</span></>;
  return (
    <div className="cp-bar" data-part="compendium.bar">
      <div className="cp-bk">
        {books.length > 1 ? (
          <Button variant="quiet" menu aria-expanded={open} onClick={() => setOpen(!open)}>{label}</Button>
        ) : <div className="cur">{label}</div>}
        {open && (
          <div className="pick" role="listbox" aria-label="Books in this scene">
            {books.map((b) => <ListRow key={b.id} variant="option" role="option" aria-selected={b.id === bookId} selected={b.id === bookId} label={b.name} onClick={() => { setOpen(false); onBook(b.id); }} />)}
          </div>
        )}
      </div>
      {chip ?? <span className="cp-chip" title="How the AI may use this book">{access === "read_only" && <Ic name="lucide:lock" size={12} />}{ACCESS_LABEL[access]}</span>}
    </div>
  );
}
