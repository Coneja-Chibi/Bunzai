/**
 * The Dashboard's Standardize banner (RoleCall `BentoDashboard.tsx:802-1219`, rc-world-comp-dashboard): shown while classic entries
 * wait, with the count, the START button (blocked in words when the book does not allow writing, with the button that fixes it),
 * and the run's controls: Batch By Entries or Tokens, Entries Per Batch (with ALL) or Token Budget (32K, 100K, 200K), Parallelism,
 * Tool Loop Cap and the model it will use. The controls write the scene's saved Standardize settings (the same ones Settings >
 * Advanced shows), except Batch By and the token budget, which are this banner's own, as in RoleCall. While a run works the drawer
 * takes its place; a finished run leaves its card. Differences from RoleCall: no "& BUILD TREE" (the tree is derived from the
 * entries), and a REVERT that retires splits where RoleCall deletes them.
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../../../app-contract";
import { accessOf, canWrite, isActive, RANGES, type ResolvedCompendium } from "../../../../../core/compendium";
import type { Chat, ChatCompendiumPatch } from "../../../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../../../_shared/error-message";
import { useSceneCompendium } from "../../use-scene-compendium";
import { GLYPH, type BookModel } from "../compendium-core";
import { Drawer, Finished, Problem, RevertDone, failedRun } from "./standardize-cards";
import { COMPENDIUM_STANDARDIZE_STYLE } from "./standardize-style";
import type { Standardize } from "./use-standardize";

const PRESETS = [32_000, 100_000, 200_000] as const;

function Stepper({ label, hint, value, min, max, step, wide, onChange, extra }: { label: string; hint: string; value: number; min: number; max: number; step: number; wide?: boolean; onChange(n: number): void; extra?: JSX.Element }): JSX.Element {
  return (
    <div className="fld">
      <label>{label}</label>
      <div className="stp">
        <button type="button" aria-label={`${label}: less`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>-</button>
        <input type="number" aria-label={label} className={wide ? "w" : undefined} min={min} max={max} value={value} onChange={(e) => { const n = Number.parseInt(e.target.value, 10); if (!Number.isNaN(n) && n >= min && n <= max) onChange(n); }} />
        <button type="button" aria-label={`${label}: more`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>+</button>
        {extra}
      </div>
      <small>{hint}</small>
    </div>
  );
}

/** The model the run will use: the Compendium's own (else the scene's) or the scene's, by the saved source. */
export const modelEcho = (chat: Chat, s: ResolvedCompendium): string =>
  (s.standardize.modelSource === "compendium" ? s.model ?? chat.connection : chat.connection)?.model ?? "No model chosen";

export function StandardizeBanner({ ctx, chat, onChat, bookId, model, std }: { ctx: AppContext; chat: Chat; onChat(chat: Chat): void; bookId: string; model: BookModel; std: Standardize }): JSX.Element | null {
  const compendium = useSceneCompendium(ctx, chat, onChat);
  const s = compendium.resolved.standardize;
  const [by, setBy] = useState<"entries" | "tokens">("entries");
  const [budget, setBudget] = useState<number>(100_000);
  const run = std.run(bookId);
  const set = (change: ChatCompendiumPatch): void => void compendium.patch(change).catch((e: unknown) => ctx.setStatus(`could not save the Standardize settings: ${toErrorMessage(e, "the scene refused it")}`));
  const write = (standardize: NonNullable<ChatCompendiumPatch["standardize"]>): void => set({ standardize });

  const startError = std.startError(bookId);
  const note = std.revertNote(bookId);
  const cards = (
    <>
      {run && !isActive(run) && run.status !== "failed" && <Finished run={run} reverting={std.reverting(bookId)} canRevert={std.revertable(bookId) > 0} onDismiss={() => void std.dismiss(bookId)} onRevert={() => void std.revert(bookId)} />}
      {run && failedRun(run) && <Problem title="Standardization Error" text={run.error ?? "Standardization failed"} log={run.log} onDismiss={() => void std.dismiss(bookId)} />}
      {note?.result && <RevertDone result={note.result} onDismiss={() => std.clearRevertNote(bookId)} />}
      {note?.error && <Problem title="Revert Failed" text={note.error} onDismiss={() => std.clearRevertNote(bookId)} />}
      {startError && <Problem title="Standardization Error" text={startError} onDismiss={() => std.clearStartError(bookId)} />}
    </>
  );
  if (run && isActive(run)) return <div className="cp-std"><style>{COMPENDIUM_STANDARDIZE_STYLE}</style><Drawer run={run} onCancel={() => void std.cancel(bookId)} />{cards}</div>;

  const waiting = model.waiting;
  const avg = waiting > 0 ? Math.ceil(model.waitingTokens / waiting) : 0;
  const perBatch = by === "entries" ? s.batchSize : avg === 0 ? s.batchSize : Math.min(waiting, Math.max(1, Math.floor(budget / avg)));
  const batches = Math.ceil(waiting / Math.max(1, perBatch));
  const access = accessOf(chat.compendium, bookId);
  const blocked = !compendium.resolved.on
    ? { reason: "The Compendium is off for this scene. Turn it on in Settings to standardize.", fix: "Turn On Compendium", apply: () => set({ on: true }) }
    : !canWrite(access)
      ? { reason: "This book does not allow writing, so Compendium cannot standardize it. Allow writing to standardize.", fix: "Enable Read + Write", apply: () => set({ books: { [bookId]: { access: "read_write" } } }) }
      : null;
  const revertable = std.revertable(bookId);

  return (
    <div className="cp-std">
      <style>{COMPENDIUM_STANDARDIZE_STYLE}</style>
      {waiting > 0 && (
        <div className="cp-std-card cta" data-part="compendium.standardize">
          <div className="hd">
            <div>
              <div className="kick">{GLYPH.diamond} Standardize Lorebook</div>
              <h2>{waiting} classic {waiting === 1 ? "entry" : "entries"} waiting to convert</h2>
              <p>This lorebook has {waiting} classic {waiting === 1 ? "entry" : "entries"} that haven&apos;t been converted to the compendium format yet. This workflow converts them, and the typed tree follows from the entries. Your original content is kept in the run&apos;s receipts and the change is fully reversible.</p>
            </div>
            <button type="button" className="cp-std-go" disabled={blocked !== null} title={blocked?.reason} onClick={() => void std.start(bookId, by === "tokens" ? { by, tokenBudget: budget } : { by })}>
              {blocked ? "STANDARDIZATION BLOCKED" : `STANDARDIZE ${GLYPH.right}`}
            </button>
          </div>
          {blocked && (
            <div className="why" role="note">
              <span>{blocked.reason}</span>
              <button type="button" className="cp-std-btn" onClick={blocked.apply}>{blocked.fix}</button>
            </div>
          )}
          <div className="ctl">
            <div className="mode">
              <label>Batch By</label>
              <div className="seg">
                <button type="button" aria-pressed={by === "entries"} className={by === "entries" ? "on" : undefined} onClick={() => setBy("entries")}>Entries</button>
                <button type="button" aria-pressed={by === "tokens"} className={by === "tokens" ? "on" : undefined} onClick={() => setBy("tokens")}>Tokens</button>
              </div>
              {avg > 0 && <small>{GLYPH.dot} avg ~{avg.toLocaleString()} tokens/entry</small>}
            </div>
            <div className="row">
              {by === "entries" ? (
                <Stepper label="Entries Per Batch" value={s.batchSize} min={RANGES.batchSize[0]} max={RANGES.batchSize[1]} step={5} onChange={(n) => write({ batchSize: n })}
                  hint={perBatch >= waiting && waiting > 0 ? "Single-batch run, best dedup" : `${batches} batch${batches === 1 ? "" : "es"} of ${perBatch}`}
                  extra={<button type="button" className="all" disabled={waiting === 0} title={`Set to ${waiting} (process everything in one batch)`} onClick={() => write({ batchSize: Math.min(RANGES.batchSize[1], Math.max(1, waiting)) })}>ALL</button>} />
              ) : (
                <Stepper label="Token Budget Per Batch" value={budget} min={1_000} max={2_000_000} step={10_000} wide onChange={setBudget}
                  hint={avg === 0 ? "Nothing to measure yet" : `≈ ${perBatch} entries/batch ${GLYPH.dot} ${batches} batch${batches === 1 ? "" : "es"} total`}
                  extra={<>{PRESETS.map((p) => <button key={p} type="button" className={`all${budget === p ? " on" : ""}`} onClick={() => setBudget(p)}>{p / 1000}K</button>)}</>} />
              )}
              <Stepper label="Parallelism" value={s.parallelism} min={RANGES.parallelism[0]} max={RANGES.parallelism[1]} step={1} hint="Concurrent batches" onChange={(n) => write({ parallelism: n })} />
              <Stepper label="Tool Loop Cap" value={s.maxRounds} min={RANGES.maxRounds[0]} max={RANGES.maxRounds[1]} step={1} hint="Max LLM rounds per batch" onChange={(n) => write({ maxRounds: n })} />
              <div className="fld echo">
                <label>Model</label>
                <div className="mdl">{modelEcho(chat, compendium.resolved)}</div>
                <small>Change in Settings {GLYPH.sep} Model</small>
              </div>
            </div>
            {revertable > 0 && (
              <div className="rev">
                <div><span>Bad run? </span>Revert to undo all standardize writes (restores originals, retires splits). Export from the header first to keep a backup.</div>
                <button type="button" className="cp-std-btn danger" disabled={std.reverting(bookId)} onClick={() => void std.revert(bookId)}>{std.reverting(bookId) ? "REVERTING..." : `${GLYPH.revert} REVERT`}</button>
              </div>
            )}
          </div>
        </div>
      )}
      {cards}
    </div>
  );
}
