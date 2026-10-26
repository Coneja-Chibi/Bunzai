/**
 * The book bar's access chip (RoleCall `CompendiumWingPanel.tsx:1125-1203`): the book's access, and a popover to change it with RoleCall's four
 * choices and copy. It writes through the same patch the Settings tab's Access row does (`accessChange`), so the two cannot disagree; a book
 * taken off writes access "off" and, like the tab, takes the default write book with it when write goes away.
 */
import { useState, type JSX } from "react";
import { accessOf } from "../../../../../../core/compendium/defaults";
import type { Chat, CompendiumAccess } from "../../../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../../../app-contract";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { Ic } from "../../../../../_shared/ic";
import { Card, Chip } from "../../../../../components/button";
import { protect } from "../../../../../_shared/protected-control";
import { useSceneCompendium } from "../../../use-scene-compendium";
import { accessChange } from "./books";

const CHOICES: readonly { value: CompendiumAccess; label: string; text: string }[] = [
  { value: "read_write", label: "Read + Write", text: "AI can read entries and create/modify them." },
  { value: "read_only", label: "Read-Only", text: "AI can use entries as context but won't modify them. Use for curated lorebooks." },
  { value: "write_only", label: "Write-Only", text: "AI can create entries but won't see existing ones. Useful for capturing new world facts without polluting context." },
  { value: "off", label: "Disabled", text: "AI ignores this book entirely. No reads, no writes, not in compendium counts." },
];

const CHIP_STYLE = `
.scs .cp-chipw{position:relative;display:inline-flex}
.scs .cp-chipp{position:absolute;top:100%;right:0;z-index:5;display:flex;flex-direction:column;gap:4px;width:min(22rem,80vw);margin-top:4px;padding:10px;border:2px solid var(--stage-black);background:var(--stage-panel);box-shadow:3px 3px 0 0 var(--stage-black)}
.scs .cp-chipp>b{font:700 var(--text-meta) var(--font-big);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-card)}
`;

export function AccessChip({ ctx, chat, bookId, bookName, onChat }: { ctx: AppContext; chat: Chat; bookId: string; bookName: string; onChat(chat: Chat): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const compendium = useSceneCompendium(ctx, chat, onChat);
  const access = accessOf(chat.compendium, bookId);
  const pick = (next: CompendiumAccess): void => {
    setOpen(false);
    compendium.patch(accessChange(bookId, next, chat.compendium?.writeBook === bookId)).catch((e: unknown) => ctx.setStatus(`could not save the Compendium settings: ${toErrorMessage(e, "the scene refused it")}`));
  };
  return (
    <span className="cp-chipw" data-part="compendium.access">
      <style>{CHIP_STYLE}</style>
      <span {...protect("compendium-access")}>
        <Chip aria-expanded={open} title="How the AI may use this book" onClick={() => setOpen(!open)}>
          {access === "read_only" && <Ic name="lucide:lock" size={12} />}{CHOICES.find((c) => c.value === access)!.label}<Ic name="lucide:chevron-down" size={12} />
        </Chip>
      </span>
      {open && (
        <div {...protect("compendium-access", "cp-chipp")} role="dialog" aria-label={`AI Access for ${bookName}`}>
          <b>AI Access for &quot;{bookName}&quot;</b>
          {CHOICES.map((c) => (
            <Card key={c.value} kind="choice" heading={c.label} subtitle={c.text} selected={c.value === access} aria-pressed={c.value === access} onClick={() => pick(c.value)} />
          ))}
        </div>
      )}
    </span>
  );
}
