/**
 * Reconcile (RoleCall `RelationshipReconcileModal`, 04b section 1.7): the `RECONCILE (N)` header button and the modal that lists
 * every one-sided relationship, grouped by the character that lacks the reference, with MIRROR ALL, MIRROR GROUP and per row MIRROR
 * and KEEP, the states MIRRORED, KEPT and FAILED, and "N / M resolved". Unlike RoleCall, KEEP is saved (the count stops coming
 * back), every action is a revision-checked server write with a receipt and an Undo in Activity, and a book that does not allow
 * the Compendium to write is not offered. The wing hands its header slot no book, so this reads every writable scene book.
 */
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { Button } from "../../../components/button";
import type { SceneLoreBook } from "../../../app-contract-scenes";
import type { Chat } from "../../../../stage/contracts/chat-store";
import { accessOf, canWrite, pairKey, type ReconcileRow } from "../../../../core/compendium";
import { InkDialog } from "../../../components/ink-dialog";
import { LOCK_TEXT } from "./standardize/standardize-cards";
import { toErrorMessage } from "../../../_shared/error-message";

type Mark = "mirrored" | "kept" | "failed";
interface BookRows { bookId: string; name: string; rows: ReconcileRow[] }
interface Pick { bookId: string; row: ReconcileRow }

/** The one-sided edges of every writable book of the scene; refreshed after each action. */
function useReconcile(ctx: AppContext, chat: Chat, books: readonly SceneLoreBook[]): { groups: BookRows[]; reload(): Promise<void> } {
  const [groups, setGroups] = useState<BookRows[]>([]);
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);
  const key = books.map((b) => `${b.id}:${b.missing ? 0 : 1}`).join(",") + JSON.stringify(chat.compendium?.books ?? {});
  const reload = useCallback(async (): Promise<void> => {
    const mine = books.filter((b) => !b.missing && canWrite(accessOf(chat.compendium, b.id)));
    const got = await Promise.all(mine.map(async (b): Promise<BookRows> => ({ bookId: b.id, name: b.name, rows: (await api.current.listCompendiumReconcile(chat.id, b.id).catch(() => ({ rows: [] }))).rows })));
    if (live.current) setGroups(got.filter((g) => g.rows.length > 0));
  }, [chat.id, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, [reload]);
  return { groups, reload };
}

export function ReconcileButton({ ctx, chat, books, locked = false }: { ctx: AppContext; chat: Chat; books: readonly SceneLoreBook[]; locked?: boolean }): JSX.Element | null {
  const { groups, reload } = useReconcile(ctx, chat, books);
  const [open, setOpen] = useState(false);
  const n = groups.reduce((sum, g) => sum + g.rows.length, 0);
  if (n === 0 && !open) return null;
  return (
    <>
      <Button size="sm" tone="var(--bk-role-danger-text)" data-part="compendium.reconcile" disabled={locked} title={locked ? LOCK_TEXT : undefined} onClick={() => setOpen(true)}>Reconcile ({n})</Button>
      {open && <ReconcileModal ctx={ctx} chatId={chat.id} groups={groups} onClose={() => { setOpen(false); void reload(); }} />}
    </>
  );
}

function ReconcileModal({ ctx, chatId, groups, onClose }: { ctx: AppContext; chatId: string; groups: BookRows[]; onClose(): void }): JSX.Element {
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [initial] = useState(groups);
  const all: Pick[] = initial.flatMap((g) => g.rows.map((row) => ({ bookId: g.bookId, row })));
  const markOf = (p: Pick): Mark | undefined => marks[`${p.bookId}:${pairKey(p.row)}`];
  const resolved = all.filter((p) => { const m = markOf(p); return m !== undefined && m !== "failed"; }).length;
  const unresolved = (picks: Pick[]) => picks.filter((p) => { const m = markOf(p); return m === undefined || m === "failed"; });

  const apply = async (action: "mirror" | "keep", picks: Pick[]): Promise<void> => {
    setBusy(true);
    setNote(null);
    try {
      for (const bookId of new Set(picks.map((p) => p.bookId))) {
        const mine = picks.filter((p) => p.bookId === bookId);
        const done = await ctx.api.reconcileCompendium(chatId, bookId, action, mine.map((p) => ({ sourceEntryId: p.row.sourceEntryId, targetEntryId: p.row.targetEntryId })));
        const next: Record<string, Mark> = {};
        for (const p of mine) next[`${bookId}:${pairKey(p.row)}`] = done.states[pairKey(p.row)] === "failed" ? "failed" : action === "mirror" ? "mirrored" : "kept";
        setMarks((had) => ({ ...had, ...next }));
        if (done.receipt?.status === "failed") setNote(done.receipt.reason ?? "The book changed while reconciling; nothing was written.");
      }
    } catch (e) {
      setNote(toErrorMessage(e, "Reconcile failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <InkDialog ariaLabel="Reconcile Relationships" onDismiss={onClose} sheetClassName="cp-rec">
      <header>
        <h3>Reconcile Relationships</h3>
        <b>{all.length === 0 ? "All Relationships Reciprocated" : `${all.length} One-Sided ${all.length === 1 ? "Edge" : "Edges"}`}</b>
        <p>These are relationships that exist on one side but not the other. Mirror to add the missing reference, or keep asymmetric if the one-sidedness is intentional (unrequited feelings, oblivious rivalries, one-way reverence).</p>
        {unresolved(all).length > 1 && <Button variant="primary" size="sm" disabled={busy} onClick={() => void apply("mirror", unresolved(all))}>Mirror all</Button>}
      </header>
      {note && <div className="note" role="status">{note}</div>}
      <div className="body">
        {initial.flatMap((g) => Object.entries(Object.groupBy(g.rows, (r) => r.targetTitle)).map(([target, rows]) => {
          const picks = (rows ?? []).map((row): Pick => ({ bookId: g.bookId, row }));
          return (
            <section key={`${g.bookId}:${target}`}>
              <div className="gh"><b>{target}</b><small>{initial.length > 1 ? g.name : ""}</small>
                {unresolved(picks).length > 1 && <Button size="sm" disabled={busy} onClick={() => void apply("mirror", unresolved(picks))}>Mirror group</Button>}
              </div>
              {picks.map(/* bounded-ok: fields of one entry card, one run's summary, or capped by a SHOWN/LIMIT constant */ (p) => {
                const mark = markOf(p);
                return (
                  <div className="row" key={pairKey(p.row)}>
                    <span><b>{p.row.sourceTitle}</b> names {target}{p.row.nature ? ` as ${p.row.nature}` : ""}{p.row.status ? ` (${p.row.status})` : ""}</span>
                    {mark && mark !== "failed" ? <em className="done">{mark === "mirrored" ? "Mirrored" : "Kept"}</em> : (
                      <span className="acts">
                        {mark === "failed" && <em className="bad">Failed</em>}
                        <Button size="sm" disabled={busy} onClick={() => void apply("mirror", [p])}>Mirror</Button>
                        <Button size="sm" disabled={busy} onClick={() => void apply("keep", [p])}>Keep</Button>
                      </span>
                    )}
                  </div>
                );
              })}
            </section>
          );
        }))}
      </div>
      <footer><small>{resolved} / {all.length} resolved</small><Button variant="primary" onClick={onClose}>Done</Button></footer>
    </InkDialog>
  );
}
