/**
 * The Control Booth's Lorebooks row (RoleCall's QuickPlayPanel "Lorebooks", :1653-1706): one line per
 * book the scene reads, with its tokens and entries and a power switch. No add, remove or reorder here;
 * the World wing owns those. The switch is the World wing's own writer (use-scene-lore.ts), so a book
 * switched here reads as switched there. A book the library no longer holds says so instead of
 * loading forever (RoleCall leaves it at "Loading...").
 */
import type { JSX } from "react";
import type { AppContext } from "../../app-contract";
import { Ic } from "../../_shared/ic";
import { ToggleSwitch } from "../../components/toggle-switch";
import { useSceneLore } from "./use-scene-lore";

export function BoothLoreRow({ ctx, chatId }: { ctx: AppContext; chatId: string }): JSX.Element {
  const { lore, reload, toggle } = useSceneLore(ctx, chatId);
  return (
    <section className="bth-sec" data-part="scene.booth.lore">
      <h3>Lorebooks</h3>
      {lore.state === "loading" && <p className="bth-quiet"><Ic name="lucide:loader-circle" size={16} /> Loading...</p>}
      {lore.state === "failed" && <p className="bth-quiet" role="alert">{lore.why} <button type="button" className="bth-link" onClick={() => void reload()}>Try again</button></p>}
      {lore.state === "ready" && lore.books.length === 0 && <p className="bth-quiet">No lorebooks active</p>}
      {lore.state === "ready" && lore.books.map((b) => (
        <div key={b.id} className={`bth-row${b.enabled ? "" : " off"}`}>
          <Ic name="lucide:book-open" size={16} />
          <div className="pn"><span>{b.name}</span><small>{b.missing ? "Not in your library" : `${b.tokens.toLocaleString()} tok · ${b.entries.toLocaleString()} entries`}</small></div>
          <ToggleSwitch size="sm" on={b.enabled} aria-label={`${b.enabled ? "Switch off" : "Switch on"} ${b.name}`} onChange={() => toggle(b)} />
        </div>
      ))}
    </section>
  );
}
