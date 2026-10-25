/**
 * When & where island: each instrument band is its own collapsible <details>.
 * Open/closed state is owned by the page fold prefs (survives entry/session switches).
 */
import type { JSX, SyntheticEvent } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { recursionModeOf, recursionPatch, type RecursionMode } from "../../../_shared/lore-recursion";
import { Slider } from "../../../components/slider";
import { PositionPicker } from "./position-picker";
import { fieldOr, framed as f, useFramed } from "../framed";
import { timingLine } from "./entry-fire-mode";
import {
  foldIsOpen,
  type EntryFoldId,
  type FoldMap,
} from "./entry-fold-prefs";

export interface EntryWhenWhereProps {
  entry: LorebookEntry;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<LorebookEntry>) => void;
  folds: FoldMap;
  onFoldToggle: (id: EntryFoldId, open: boolean) => void;
}

type ShowKey = Parameters<typeof fieldVisible>[1];

const WW: Record<string, EntryFoldId> = {
  nums: "ww.nums",
  rhythm: "ww.rhythm",
  group: "ww.group",
  rec: "ww.rec",
  chance: "ww.chance",
  place: "ww.place",
};

function scanLabel(scanDepth: number | null): string {
  return scanDepth === null || scanDepth === undefined ? "-" : String(scanDepth);
}

export function EntryWhenWhere({
  entry,
  writeFor,
  styles,
  onPatch,
  folds,
  onFoldToggle,
}: EntryWhenWhereProps): JSX.Element | null {
  const themed = useFramed();
  const isOpen = (band: keyof typeof WW): boolean => foldIsOpen(folds, WW[band]!);
  const onBand =
    (band: keyof typeof WW) =>
    (ev: SyntheticEvent<HTMLDetailsElement>): void => {
      onFoldToggle(WW[band]!, ev.currentTarget.open);
    };

  const show = (key: ShowKey): boolean => fieldVisible(writeFor, key);
  const hasChance = show("probability");
  const hasRhythm = show("sticky") || show("cooldown") || show("delay");
  const hasRecursion = show("recursion");
  const hasGroup = show("groupName");
  const hasPlace = show("position");
  const hasNumbers = show("sortOrder") || show("priority") || show("scanDepth");
  if (!hasChance && !hasRhythm && !hasRecursion && !hasGroup && !hasPlace && !hasNumbers) {
    return null;
  }

  const recursionMode: RecursionMode = recursionModeOf(entry);
  const setRecursion = (mode: RecursionMode): void => onPatch(recursionPatch(mode, entry.delayUntilRecursion));

  const chancePct = Math.max(0, Math.min(100, entry.probability));
  const recShort =
    recursionMode === "normal" ? "norm" : recursionMode === "prevent" ? "prev" : "delay";
  const outerOpen = foldIsOpen(folds, "whenWhere");

  return (
    <details
      className={styles.bfold}
      open={outerOpen}
      onToggle={(ev) => onFoldToggle("whenWhere", ev.currentTarget.open)}
      aria-label="When and where"
    >
      <summary className={styles.bchead}>
        <b>When &amp; where</b>
        <i title={timingLine(entry)}>{timingLine(entry)}</i>
      </summary>
      <div className={styles.bcbody}>
        <div className={styles.wwGrid}>
          {hasNumbers && (
            <details className={styles.wwFold} open={isOpen("nums")} onToggle={onBand("nums")}>
              <summary className={styles.wwFoldH}>
                <b>Order · Priority · Scan</b>
                <em>
                  {entry.sortOrder} · {entry.priority} · {scanLabel(entry.scanDepth)}
                </em>
                <span>placement</span>
              </summary>
              <div className={styles.wwFoldBody}>
                <div className={themed ? f.fields : styles.wwTri}>
                  {show("sortOrder") && fieldOr(themed, { label: "Order" }, (
                    <input
                      className={themed ? styles.wwNum : undefined}
                      type="number"
                      inputMode="numeric"
                      value={entry.sortOrder}
                      aria-label="Insertion order"
                      onFocus={(ev) => ev.currentTarget.select()}
                      onChange={(ev) => onPatch({ sortOrder: Number(ev.target.value) || 0 })}
                    />
                    ), (c) => (
                      <label className={styles.wwDial}>
                        <span>Order</span>
                        {c}
                      </label>
                    ))}
                  {show("priority") && fieldOr(themed, { label: "Priority" }, (
                    <input
                      className={themed ? styles.wwNum : undefined}
                      type="number"
                      inputMode="numeric"
                      value={entry.priority}
                      aria-label="Budget priority"
                      onFocus={(ev) => ev.currentTarget.select()}
                      onChange={(ev) => onPatch({ priority: Number(ev.target.value) || 0 })}
                    />
                    ), (c) => (
                      <label className={styles.wwDial}>
                        <span>Priority</span>
                        {c}
                      </label>
                    ))}
                  {show("scanDepth") && fieldOr(themed, { label: "Scan depth" }, (
                    <input
                      className={themed ? styles.wwNum : undefined}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="-"
                      value={entry.scanDepth ?? ""}
                      aria-label="Scan depth (blank inherits the book default)"
                      onFocus={(ev) => ev.currentTarget.select()}
                      onChange={(ev) => {
                        const v = ev.target.value;
                        onPatch({ scanDepth: v === "" ? null : Number(v) || 0 });
                      }}
                    />
                    ), (c) => (
                      <label className={styles.wwDial}>
                        <span>Scan</span>
                        {c}
                      </label>
                    ))}
                </div>
              </div>
            </details>
          )}

          {hasRhythm && (
            <details className={styles.wwFold} open={isOpen("rhythm")} onToggle={onBand("rhythm")}>
              <summary className={styles.wwFoldH}>
                <b>Rhythm</b>
                <em>
                  {entry.sticky} / {entry.cooldown} / {entry.delay}
                </em>
                <span>messages</span>
              </summary>
              <div className={styles.wwFoldBody}>
                <div className={themed ? f.fields : styles.wwTri}>
                  {show("sticky") && fieldOr(themed, { label: "Sticky" }, (
                    <input
                      className={themed ? styles.wwNum : undefined}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={entry.sticky}
                      aria-label="Sticky messages"
                      onFocus={(ev) => ev.currentTarget.select()}
                      onChange={(ev) => onPatch({ sticky: Number(ev.target.value) || 0 })}
                    />
                    ), (c) => (
                      <label className={styles.wwDial}>
                        <span>Sticky</span>
                        {c}
                      </label>
                    ))}
                  {show("cooldown") && fieldOr(themed, { label: "Cool" }, (
                    <input
                      className={themed ? styles.wwNum : undefined}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={entry.cooldown}
                      aria-label="Cool messages"
                      onFocus={(ev) => ev.currentTarget.select()}
                      onChange={(ev) => onPatch({ cooldown: Number(ev.target.value) || 0 })}
                    />
                    ), (c) => (
                      <label className={styles.wwDial}>
                        <span>Cool</span>
                        {c}
                      </label>
                    ))}
                  {show("delay") && fieldOr(themed, { label: "Delay" }, (
                    <input
                      className={themed ? styles.wwNum : undefined}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={entry.delay}
                      aria-label="Delay messages"
                      onFocus={(ev) => ev.currentTarget.select()}
                      onChange={(ev) => onPatch({ delay: Number(ev.target.value) || 0 })}
                    />
                    ), (c) => (
                      <label className={styles.wwDial}>
                        <span>Delay</span>
                        {c}
                      </label>
                    ))}
                </div>
              </div>
            </details>
          )}

          {hasGroup && (
            <details className={styles.wwFold} open={isOpen("group")} onToggle={onBand("group")}>
              <summary className={styles.wwFoldH}>
                <b>Group</b>
                <em>{entry.groupName?.trim() || "none"}</em>
                <span>one of set</span>
              </summary>
              <div className={styles.wwFoldBody}>
                <div className={themed ? f.fields : styles.wwCtrl}>
                  {fieldOr(themed, { label: "Inclusion group" }, (
                    <input
                      className={styles.wwGroupIn}
                      value={entry.groupName ?? ""}
                      placeholder="None"
                      aria-label="Inclusion group"
                      onChange={(ev) => onPatch({ groupName: ev.target.value || null })}
                    />
                  ), (c) => c)}
                  {show("groupTuning") && (
                    fieldOr(themed, { label: "Group weight" }, (
                      <input
                        className={styles.wwWeight}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={entry.groupWeight}
                        aria-label="Inclusion-group weight"
                        onFocus={(ev) => ev.currentTarget.select()}
                        onChange={(ev) => onPatch({ groupWeight: Number(ev.target.value) || 0 })}
                      />
                    ), (c) => (<><span className={styles.wwW}>w</span>{c}</>))
                  )}
                </div>
              </div>
            </details>
          )}

          {hasRecursion && (
            <details className={styles.wwFold} open={isOpen("rec")} onToggle={onBand("rec")}>
              <summary className={styles.wwFoldH}>
                <b>Recursion</b>
                <em>{recShort}</em>
                <span>wake</span>
              </summary>
              <div className={styles.wwFoldBody}>
                <div className={themed ? f.fields : styles.wwCtrl}>
                  {fieldOr(themed, { label: "Recursion" }, (
                    <div className={styles.wwSeg} role="group" aria-label="Recursion mode">
                      {(["normal", "prevent", "delay"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={
                            recursionMode === mode
                              ? `${styles.wwSegBtn} ${styles.wwSegOn}`
                              : styles.wwSegBtn
                          }
                          aria-pressed={recursionMode === mode}
                          onClick={() => setRecursion(mode)}
                        >
                          {mode === "normal" ? "Norm" : mode === "prevent" ? "Prev" : "Delay"}
                        </button>
                      ))}
                    </div>
                  ), (c) => c)}
                  {recursionMode === "delay" && (
                    fieldOr(themed, { label: "Delay until level" }, (
                    <input
                      className={styles.wwRecLevel}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={entry.delayUntilRecursion}
                      aria-label="Delay until recursion level"
                      onFocus={(ev) => ev.currentTarget.select()}
                      onChange={(ev) =>
                        onPatch({ delayUntilRecursion: Number(ev.target.value) || 1 })
                      }
                    />
                    ), (c) => c)
                  )}
                </div>
              </div>
            </details>
          )}

          {hasChance && (
            <details className={styles.wwFold} open={isOpen("chance")} onToggle={onBand("chance")}>
              <summary className={styles.wwFoldH}>
                <b>Chance</b>
                <em>{chancePct}%</em>
                <span>probability</span>
              </summary>
              <div className={styles.wwFoldBody}>
                <div className={themed ? f.fields : styles.wwChanceRow}>
                  <span className={styles.wwPct}>{chancePct}%</span>
                  {fieldOr(themed, { label: "Chance", meter: { value: chancePct, min: 0, max: 100 } }, (
                  <Slider
                    readout={false}
                    min={0}
                    max={100}
                    value={chancePct}
                    color="var(--stage-ok)"
                    aria-label="Activation chance percent"
                    onChange={(n) => onPatch({ probability: Math.max(0, Math.min(100, n || 0)) })}
                  />
                  ), (c) => c)}
                </div>
              </div>
            </details>
          )}

          {hasPlace && (
            <details className={styles.wwFold} open={isOpen("place")} onToggle={onBand("place")}>
              <summary className={styles.wwFoldH}>
                <b>Where</b>
                <em>{entry.position}</em>
                <span>injection</span>
              </summary>
              <div className={styles.wwFoldBody}>
                <PositionPicker
                  position={entry.position}
                  depth={entry.depth}
                  role={entry.role}
                  writeFor={writeFor}
                  showDepth={show("depth")}
                  showRole={show("role")}
                  styles={styles}
                  onPatch={onPatch}
                />
              </div>
            </details>
          )}
        </div>
      </div>
    </details>
  );
}
