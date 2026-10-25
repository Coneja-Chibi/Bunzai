/**
 * Lore binder right rail: Carrot-Compass-grade tools that stay on-screen while editing.
 * - Live try: real runLore (keys, chance, recursion, timed) not sample-match
 * - Wake map: who can wake this entry / who this entry can wake (loreWakeGraph)
 * - Health tips + launchers into full panes
 * Timing dials (chance/sticky/cool/delay) are NOT here: one home on the page fold.
 *
 * M1: Live try reruns the full lore pipeline on every render,
 * so it is debounced at 150 ms the same way the regex test bench debounces its sample
 * (`workbench/regex/bench-pane.tsx`) - a keystroke resets the timer, so only the latest input ever
 * feeds `runLore`, and no run started for an older keystroke can land after a newer one's.
 */
import { useMemo, useState, type JSX } from "react";
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import { cryptoUnit, loreWakeGraph, runLore, type LoreHealthNote, type LoreVerdict } from "../../../../core/lore";
import { loreVerdictText } from "./reason-text";
import { loreTokens, toBookInput, toScan, withoutCharacterFilters } from "./lore-run";
import { ExpandTextarea } from "../../../components/expand";
import { useDebouncedValue } from "../../../_shared/use-debounced-value";

export interface EntryRailProps {
  body: LorebookBody;
  focusedId: string | null;
  entries: readonly LorebookEntry[];
  notes: readonly LoreHealthNote[];
  styles: Readonly<Record<string, string>>;
  onOpenHealth?: () => void;
  onOpenChanges?: () => void;
  onOpenRehearsal?: () => void;
  onSelectEntry?: (id: string) => void;
}

export function LoreEntryRail({
  body,
  focusedId,
  entries,
  notes,
  styles,
  onOpenHealth,
  onOpenChanges,
  onOpenRehearsal,
  onSelectEntry,
}: EntryRailProps): JSX.Element {
  const [sample, setSample] = useState("");
  const debouncedSample = useDebouncedValue(sample, 150);
  const focused = entries.find((e) => e.id === focusedId) ?? null;

  const live = useMemo(() => {
    const text = debouncedSample.trim();
    if (!text) return null;
    return runLore([toBookInput(withoutCharacterFilters(body))], toScan([{ role: "user", content: text }]), {
      rng: cryptoUnit,
      countTokens: loreTokens,
      budgetTokens: Infinity,
      recentFires: [],
      explain: true,
      chance: "roll",
    });
  }, [debouncedSample, body]);

  const wake = useMemo(() => {
    const edges = loreWakeGraph(toBookInput(body));
    if (!focusedId) {
      return { inbound: [] as typeof edges, outbound: [] as typeof edges };
    }
    return {
      inbound: edges.filter((e) => e.to === focusedId),
      outbound: edges.filter((e) => e.from === focusedId),
    };
  }, [body, focusedId]);

  const titleOf = (id: string): string =>
    entries.find((e) => e.id === id)?.title?.trim() || id;
  const entryOf = (v: LoreVerdict): LorebookEntry | undefined => entries.find((e) => e.id === v.entryId);

  const verdicts = live?.verdicts ?? [];
  const focusedVerdict = verdicts.find((v) => v.entryId === focusedId) ?? null;
  const fired = verdicts.filter((v) => v.fired);
  const cuts = verdicts.filter((v) => v.reason === "budget-cut");
  const recursionLoops = Math.max(0, ...fired.map((v) => v.loop));

  return (
    <aside className={styles.rail} aria-label="Live tools">
      {/* ---- Live try (real engine) ---- */}
      <div className={styles.rcard}>
        <div className={styles.rhead}>
          <b>Try a line</b>
          <i>real activation</i>
        </div>
        <div className={styles.rbody}>
          <ExpandTextarea
            label="Sample chat line"
            className={styles.textarea}
            style={{ minHeight: "3.2rem" }}
            placeholder="Sample chat line…"
            value={sample}
            aria-label="Sample chat line for live activation"
            onChange={(ev) => setSample(ev.target.value)}
          />
          {!live && (
            <p className={styles.hint}>
              Runs the real matcher: keys, chance, recursion, timed, budget.
            </p>
          )}
          {live && (
            <>
              {focused && focusedVerdict && (
                <div
                  className={
                    focusedVerdict.fired ? styles.focusHit : styles.focusMiss
                  }
                >
                  <span className={styles.focusLbl}>This entry</span>
                  <strong>{focused.title || "(untitled)"}</strong>
                  <span>
                    {focusedVerdict.fired ? "fires" : "skips"} ·{" "}
                    {loreVerdictText(focusedVerdict, focused)}
                    {focusedVerdict.loop > 0 ? ` · loop ${focusedVerdict.loop}` : ""}
                  </span>
                </div>
              )}
              <div className={styles.chip}>
                Fired {fired.length}
                {cuts.length > 0 ? ` · ${cuts.length} cut` : ""}
                {recursionLoops > 0 ? ` · recursion loops ${recursionLoops}` : ""}
              </div>
              {fired.length > 0 && (
                <ul className={styles.matchList}>
                  {fired.slice(0, 8).map((v) => (
                    <li key={v.entryId} className={styles.matchHit}>
                      <button
                        type="button"
                        className={styles.linkish}
                        onClick={() => onSelectEntry?.(v.entryId)}
                      >
                        {titleOf(v.entryId)}
                      </button>
                      <span>
                        {" "}
                        · {loreVerdictText(v, entryOf(v))}
                        {v.loop > 0 ? ` · L${v.loop}` : ""} · ~{v.tokens}t
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {fired.length === 0 && sample.trim() && (
                <p className={styles.hint}>Nothing fired on that line.</p>
              )}
            </>
          )}
          {onOpenRehearsal && (
            <button type="button" className={styles.texpBtn} onClick={onOpenRehearsal}>
              Open Rehearsal
            </button>
          )}
        </div>
      </div>

      {/* ---- Wake / recursion map for focused entry ---- */}
      <div className={styles.rcard}>
        <div className={styles.rhead}>
          <b>Wake map</b>
          <i>recursion</i>
        </div>
        <div className={styles.rbody}>
          {!focused && (
            <p className={styles.hint}>Pick an entry to see who wakes whom.</p>
          )}
          {focused && (
            <>
              <div className={styles.chipRow}>
                {focused.preventRecursion && (
                  <span className={styles.chip}>wakes nobody</span>
                )}
                {focused.excludeRecursion && (
                  <span className={styles.chip}>immune to wake</span>
                )}
                {focused.delayUntilRecursion > 0 && (
                  <span className={styles.chip}>
                    delay until L{focused.delayUntilRecursion}
                  </span>
                )}
                {!focused.preventRecursion &&
                  !focused.excludeRecursion &&
                  focused.delayUntilRecursion === 0 && (
                    <span className={styles.chip}>normal recursion</span>
                  )}
              </div>
              <div className={styles.wakeBlock}>
                <span className={styles.wakeLbl}>Wakes this entry</span>
                {wake.inbound.length === 0 ? (
                  <p className={styles.hint}>No other entry can wake it (chat keys only).</p>
                ) : (
                  <ul className={styles.matchList}>
                    {wake.inbound.map((e) => (
                      <li key={`${e.from}-${e.keyword}`} className={styles.matchHit}>
                        <button
                          type="button"
                          className={styles.linkish}
                          onClick={() => onSelectEntry?.(e.from)}
                        >
                          {titleOf(e.from)}
                        </button>
                        <span> · via &quot;{e.keyword}&quot;</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className={styles.wakeBlock}>
                <span className={styles.wakeLbl}>This entry can wake</span>
                {focused.preventRecursion ? (
                  <p className={styles.hint}>Prevent recursion is on.</p>
                ) : wake.outbound.length === 0 ? (
                  <p className={styles.hint}>Does not appear in any other entry&apos;s keys.</p>
                ) : (
                  <ul className={styles.matchList}>
                    {wake.outbound.map((e) => (
                      <li key={`${e.to}-${e.keyword}`} className={styles.matchHit}>
                        <button
                          type="button"
                          className={styles.linkish}
                          onClick={() => onSelectEntry?.(e.to)}
                        >
                          {titleOf(e.to)}
                        </button>
                        <span> · via &quot;{e.keyword}&quot;</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Health ---- */}
      <div className={styles.rcard}>
        <div className={styles.rhead}>
          <b>Health</b>
          <i>quiet tips</i>
        </div>
        <div className={styles.rbody}>
          {notes.length === 0 && (
            <div className={styles.healthOk}>&#9679; This entry is ready.</div>
          )}
          {notes.slice(0, 4).map((h) => (
            <div
              key={h.code}
              className={h.level === "warn" ? styles.healthTip : styles.healthOk}
            >
              {h.level === "warn" ? <>&#9650; </> : <>&#9679; </>}
              {h.message}
            </div>
          ))}
          {onOpenHealth && (
            <button type="button" className={styles.texpBtn} onClick={onOpenHealth}>
              Open the full check
            </button>
          )}
          {onOpenChanges && (
            <button type="button" className={styles.texpBtn} onClick={onOpenChanges}>
              Open Changes
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
