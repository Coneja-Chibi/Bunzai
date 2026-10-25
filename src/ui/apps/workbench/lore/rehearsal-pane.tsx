/**
 * Rehearsal companion: Try lines with real runLore verdicts + real crypto RNG for chance.
 * Playback tab for chat jsonl. Canned stand-in replies only - never a model call.
 */
import { useMemo, useRef, useState, type FormEvent, type JSX } from "react";
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import { cryptoUnit, runLore, type LoreFire, type LoreRun, type LoreVerdict, type ScanLine } from "../../../../core/lore";
import { loreVerdictText } from "./reason-text";
import { loreTokens, toBookInput, toScan, withoutCharacterFilters, withoutOwnBudget } from "./lore-run";
import { PlaybackTab } from "./playback-tab";
import styles from "./rehearsal-pane.module.css";

const CANNED = [
  "The air stills for a beat.",
  "A distant bell marks the hour.",
  "They wait for your next move.",
  "Nothing answers but the wind.",
];

export interface RehearsalPaneProps {
  body: LorebookBody;
  onClose: () => void;
  onJumpEntry: (id: string) => void;
  /** Add a matched keyword onto an entry (copy fired as key). */
  onAddKeyword?: (entryId: string, keyword: string) => void;
}

type BudgetPreset = "off" | "book" | "512" | "1024";

/** Move a run's fires into the next turn's recentFires: this turn's at messagesAgo 1, every older
 * one pushed back by one message (Rehearsal's turnState -> recentFires port). */
function advanceFires(prev: LoreFire[], fires: LoreRun["fires"]): LoreFire[] {
  return [
    ...fires.map((f) => ({ entryKey: f.entryKey, messagesAgo: 1, fresh: f.fresh, keywords: f.keywords })),
    ...prev.map((f) => ({ ...f, messagesAgo: f.messagesAgo + 1 })),
  ];
}

function runBody(body: LorebookBody, preset: BudgetPreset): { body: LorebookBody; budgetTokens: number } {
  const base = withoutCharacterFilters(body);
  if (preset === "book") return { body: base, budgetTokens: Infinity };
  const flat = withoutOwnBudget(base);
  if (preset === "off") return { body: flat, budgetTokens: Infinity };
  return { body: flat, budgetTokens: preset === "512" ? 512 : 1024 };
}

export function RehearsalPane({
  body,
  onClose,
  onJumpEntry,
  onAddKeyword,
}: RehearsalPaneProps): JSX.Element {
  const [tab, setTab] = useState<"try" | "playback">("try");
  const [chat, setChat] = useState<ScanLine[]>([]);
  const [input, setInput] = useState("");
  const [recentFires, setRecentFires] = useState<LoreFire[]>([]);
  const [cannedAt, setCannedAt] = useState(0);
  const [last, setLast] = useState<LoreRun | null>(null);
  const [budgetPreset, setBudgetPreset] = useState<BudgetPreset>(
    body.tokenBudget > 0 ? "book" : "off",
  );
  // Real crypto RNG every roll - never a fixed constant. Ref so identity stays stable in say().
  const rngRef = useRef(cryptoUnit);

  const { body: runFor, budgetTokens } = useMemo(() => runBody(body, budgetPreset), [body, budgetPreset]);

  const budgetLine = useMemo(() => {
    if (!Number.isFinite(budgetTokens)) return null;
    return `${last?.totalTokens ?? 0} / ${budgetTokens} tokens used`;
  }, [last, budgetTokens]);

  const say = (text: string): void => {
    const user: ScanLine = { text, role: "user" };
    const window = [...chat, user];
    const result = runLore(
      [toBookInput(runFor)],
      toScan(window.map((l) => ({ role: l.role, content: l.text }))),
      {
        rng: rngRef.current,
        countTokens: loreTokens,
        budgetTokens,
        recentFires,
        explain: true,
        chance: "roll",
      },
    );
    const reply = CANNED[cannedAt % CANNED.length]!;
    setCannedAt((n) => n + 1);
    setChat([...window, { text: reply, role: "assistant" }]);
    setRecentFires((prev) => advanceFires(prev, result.fires));
    setLast(result);
  };

  const onSubmit = (ev: FormEvent): void => {
    ev.preventDefault();
    const t = input.trim();
    if (!t) return;
    say(t);
    setInput("");
  };

  const verdicts = last?.verdicts ?? [];
  const fired = verdicts.filter((v) => v.fired);
  const skipped = verdicts.filter((v) => !v.fired && v.reason !== "disabled");
  const cuts = verdicts.filter((v) => v.reason === "budget-cut");

  const titleOf = (id: string): string => body.entries.find((e) => e.id === id)?.title || id;
  const entryOf = (v: LoreVerdict): LorebookEntry | undefined => body.entries.find((e) => e.id === v.entryId);

  return (
    <aside className={styles.pane} aria-label="Rehearsal">
      <div className={styles.head}>
        <b>Rehearsal</b>
        <i>try lines · real chance rolls</i>
        <button type="button" className={styles.x} aria-label="Close rehearsal" onClick={onClose}>
          &times;
        </button>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Rehearsal mode">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "try"}
          className={tab === "try" ? `${styles.tab} ${styles.tabOn}` : styles.tab}
          onClick={() => setTab("try")}
        >
          Try lines
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "playback"}
          className={tab === "playback" ? `${styles.tab} ${styles.tabOn}` : styles.tab}
          onClick={() => setTab("playback")}
        >
          Playback
        </button>
      </div>

      {tab === "playback" ? (
        <PlaybackTab body={body} onJumpEntry={onJumpEntry} />
      ) : (
        <>
          <div className={styles.budgetBar} role="group" aria-label="Token budget for this rehearsal">
            <span className={styles.budgetLbl}>Budget</span>
            {(
              [
                ["off", "Off"],
                ["book", "Book"],
                ["512", "512"],
                ["1024", "1024"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={
                  budgetPreset === id ? `${styles.tab} ${styles.tabOn}` : styles.tab
                }
                aria-pressed={budgetPreset === id}
                onClick={() => setBudgetPreset(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={styles.chat}>
            {chat.length === 0 && (
              <p className={styles.empty}>
                Type a line to see what would fire. Chance uses a real roll every time.
              </p>
            )}
            {chat.map((m, i) => (
              <div key={i} className={m.role === "user" ? styles.user : styles.bot}>
                {m.text}
              </div>
            ))}
          </div>

          <form className={styles.composer} onSubmit={onSubmit}>
            <input
              value={input}
              onChange={(ev) => setInput(ev.target.value)}
              placeholder="Type something to test…"
              aria-label="Rehearsal line"
            />
            <button type="submit" disabled={!input.trim()}>
              Say
            </button>
          </form>

          {last && (
            <div className={styles.results}>
              <div className={styles.rhead}>Fired ({fired.length})</div>
              {fired.length === 0 && <p className={styles.empty}>Nothing fired.</p>}
              {fired.map((v) => {
                const kw = v.reason === "key" || v.reason === "recursion" ? v.matched[0] : null;
                return (
                  <div key={v.entryId} className={styles.hitRow}>
                    <button
                      type="button"
                      className={styles.hit}
                      onClick={() => onJumpEntry(v.entryId)}
                    >
                      <b>{titleOf(v.entryId)}</b>
                      <span>
                        {loreVerdictText(v, entryOf(v))} · ~{v.tokens}t
                      </span>
                    </button>
                    {kw && onAddKeyword && (
                      <button
                        type="button"
                        className={styles.addKey}
                        title={`Add "${kw}" as a key on this entry`}
                        onClick={() => onAddKeyword(v.entryId, kw)}
                      >
                        + key
                      </button>
                    )}
                  </div>
                );
              })}
              {budgetLine && <p className={styles.budget}>{budgetLine}</p>}
              {cuts.length > 0 && (
                <details className={styles.cuts} open>
                  <summary>Cut by budget ({cuts.length})</summary>
                  {cuts.map((v) => (
                    <div key={v.entryId}>{loreVerdictText(v, entryOf(v))}</div>
                  ))}
                </details>
              )}
              <details className={styles.miss}>
                <summary>Didn&apos;t fire ({skipped.length})</summary>
                {skipped.map((v) => (
                  <button
                    key={v.entryId}
                    type="button"
                    className={styles.skip}
                    onClick={() => onJumpEntry(v.entryId)}
                  >
                    <b>{titleOf(v.entryId)}</b>
                    <span>{loreVerdictText(v, entryOf(v))}</span>
                  </button>
                ))}
              </details>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
