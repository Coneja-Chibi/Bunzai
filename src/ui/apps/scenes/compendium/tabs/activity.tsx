/**
 * The Activity feed (RoleCall `LorebookActivityFeed.tsx`, rc-world-comp-activity.png): ALL | ENTRIES | TOOLS (arrow keys, Home and
 * End move between them, `:352-370`), the pop-out button when it is docked, a Clear feed button, and a card per receipt and per
 * recalled entry, newest first. Receipts are the durable record (RoleCall's live feed is client state that clears with the page):
 * Clear feed moves a watermark and deletes nothing (04b F25). Undo and File again go through the server's one book writer. `extra`
 * carries the PRE cards read from the replies' traces, and `extraWhy` says when they could not be read. The pop-out itself is the
 * registry's (popout/); this draws only the button.
 */
import { useId, useState, type JSX, type KeyboardEvent } from "react";
import { Ic } from "../../../../_shared/ic";
import type { AppContext } from "../../../../app-contract";
import { toErrorMessage } from "../../../../_shared/error-message";
import { PopoutButton } from "../../popout/popout-panel";
import { feedRows, type ActivityRow, type FeedTab } from "../activity-core";
import { ActivityCard } from "../activity-card";
import type { Receipts } from "../use-compendium-receipts";

const TABS: { id: FeedTab; label: string }[] = [{ id: "all", label: "All" }, { id: "entries", label: "Entries" }, { id: "tools", label: "Tools" }];

export function ActivityTab({ ctx, chatId, feed, extra = [], extraWhy, pop }: {
  ctx: AppContext; chatId: string; feed: Receipts; extra?: readonly ActivityRow[]; extraWhy?: string;
  /** Given while the feed is docked: the pop-out button. */
  pop?: { id: string; open(): void };
}): JSX.Element {
  const [tab, setTab] = useState<FeedTab>("all");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const base = `cp-feed-${useId().replace(/:/g, "")}`;
  const now = Date.now();
  const rows = [...feedRows(feed.receipts, feed.feedClearedAt, tab, feed.facts), ...extra.filter((r) => r.at > feed.feedClearedAt && (tab === "all" || r.tab === tab))].sort((a, b) => b.at - a.at);

  const run = async (work: () => Promise<unknown>, failed: string): Promise<void> => {
    setBusy(true);
    setNote(null);
    try { await work(); await feed.reload(); } catch (e) { setNote(toErrorMessage(e, failed)); await feed.reload(); } finally { setBusy(false); }
  };
  const actions = {
    busy,
    undo: (id: string) => void run(async () => {
      const undo = await ctx.api.undoCompendiumReceipt(chatId, id);
      if (undo.status !== "filed") setNote(undo.reason ?? "Some entries could not be restored.");
    }, "Undo failed"),
    again: (id: string) => void run(() => ctx.api.fileCompendiumAgain(chatId, id), "Filing again failed"),
  };
  const roving = (e: KeyboardEvent<HTMLButtonElement>, at: number): void => {
    const next = e.key === "ArrowRight" ? (at + 1) % TABS.length : e.key === "ArrowLeft" ? (at + TABS.length - 1) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setTab(TABS[next]!.id);
    e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-feed-tab="${TABS[next]!.id}"]`)?.focus();
  };

  return (
    <div className="cp-feed" data-part="compendium.activity">
      <div className="bar">
        <div className="seg" role="tablist" aria-label="Compendium activity filters">
          {TABS.map((t, i) => (
            <button key={t.id} type="button" role="tab" id={`${base}-tab-${t.id}`} data-feed-tab={t.id} aria-selected={tab === t.id} aria-controls={`${base}-panel`}
              tabIndex={tab === t.id ? 0 : -1} className={tab === t.id ? "on" : ""} onKeyDown={(e) => roving(e, i)} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="acts">
          {pop && <PopoutButton id={pop.id} onClick={pop.open} />}
          <button type="button" className="ib" title="Clear feed" aria-label="Clear feed" disabled={feed.receipts.length === 0 && extra.length === 0} onClick={() => void run(feed.clear, "The feed could not be cleared")}><Ic name="lucide:trash-2" size={14} /></button>
        </div>
      </div>
      {note && <div className="cp-note" role="status">{note}</div>}
      {feed.state === "failed" && <div className="cp-load bad">{feed.why}</div>}
      {extraWhy && <div className="cp-load bad">{extraWhy}</div>}
      {feed.state === "loading" && <div className="cp-load">Loading activity...</div>}
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${tab}`}>
        {feed.state === "ready" && rows.length === 0 && (
          <div className="empty"><span className="ring"><Ic name="lucide:zap" size={20} /></span><b>No activity yet</b><small>Compendium tool calls will stream here in real-time.</small></div>
        )}
        <div className="list">{rows.map((row) => <ActivityCard key={row.id} row={row} now={now} actions={actions} />)}</div>
      </div>
    </div>
  );
}
