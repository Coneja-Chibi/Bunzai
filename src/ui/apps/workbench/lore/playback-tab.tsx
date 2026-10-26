/**
 * Rehearsal Playback tab: drop/open a chat file, replay runLore with exact marks + near-misses.
 */
import { InlineValue } from "../../../components/button";
import { VirtualRows } from "../../../_shared/virtual-list";
import { useState, type JSX } from "react";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import { nearMisses, parseChatJsonl, runLore, type LoreFire, type ScanLine } from "../../../../core/lore";
import { loreTokens, toBookInput, toScan, withoutCharacterFilters, withoutOwnBudget } from "./lore-run";
import styles from "./rehearsal-pane.module.css";

const TURN_ESTIMATE_PX = 56;
const TURN_GAP_PX = 6;

export interface PlaybackTabProps {
  body: LorebookBody;
  onJumpEntry: (id: string) => void;
}

interface TurnView {
  line: ScanLine;
  exactKeywords: string[];
  near: { word: string; keys: string[]; entryIds: string[] }[];
  firedTitles: string[];
}

/** Deterministic: Playback shows what WOULD fire, not a fresh roll on every replay. */
const STABLE_RNG = (): number => 0.5;

export function PlaybackTab({ body, onJumpEntry }: PlaybackTabProps): JSX.Element {
  const [turns, setTurns] = useState<TurnView[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const runLines = (lines: ScanLine[], skipped: number): void => {
    const runFor = withoutOwnBudget(withoutCharacterFilters(body));
    const allKeys = body.entries.flatMap((e) =>
      e.triggers.map((t) => t.keyword).filter(Boolean),
    );
    const keyToEntries = new Map<string, string[]>();
    for (const e of body.entries) {
      for (const t of e.triggers) {
        const k = t.keyword.toLowerCase();
        if (!k) continue;
        const list = keyToEntries.get(k) ?? [];
        list.push(e.id);
        keyToEntries.set(k, list);
      }
    }

    const out: TurnView[] = [];
    const window: ScanLine[] = [];
    let recentFires: LoreFire[] = [];
    for (const line of lines) {
      window.push(line);
      if (line.role !== "user") {
        out.push({ line, exactKeywords: [], near: [], firedTitles: [] });
        continue;
      }
      const result = runLore([toBookInput(runFor)], toScan(window.map((l) => ({ role: l.role, content: l.text }))), {
        rng: STABLE_RNG,
        countTokens: loreTokens,
        budgetTokens: Infinity,
        recentFires,
        explain: true,
        chance: "always",
      });
      recentFires = [
        ...result.fires.map((f) => ({ entryKey: f.entryKey, messagesAgo: 1, fresh: f.fresh, keywords: f.keywords })),
        ...recentFires.map((f) => ({ ...f, messagesAgo: f.messagesAgo + 1 })),
      ];

      const fired = (result.verdicts ?? []).filter((v) => v.fired);
      const exactKeywords: string[] = [];
      for (const v of fired) {
        if (v.reason !== "key" && v.reason !== "secondary" && v.reason !== "recursion") continue;
        for (const kw of v.matched) if (!kw.startsWith("[")) exactKeywords.push(kw);
      }
      const firedTitles = fired.map((v) => body.entries.find((e) => e.id === v.entryId)?.title || v.entryId);

      // Near-miss only on words that are not exact hits
      const exactSet = new Set(exactKeywords.map((k) => k.toLowerCase()));
      const words = line.text.split(/(\s+|[.,!?;"'()])/g).filter(Boolean);
      const near: TurnView["near"] = [];
      for (const word of words) {
        if (!word.trim() || /^\s+$/.test(word) || /^[.,!?;"'()]+$/.test(word)) continue;
        if (exactSet.has(word.toLowerCase())) continue;
        const hits = nearMisses(word, allKeys, 3);
        if (hits.length === 0) continue;
        const keys = hits.map((h) => h.key);
        const entryIds = [
          ...new Set(
            keys.flatMap((k) => keyToEntries.get(k.toLowerCase()) ?? []),
          ),
        ];
        near.push({ word, keys, entryIds });
      }

      out.push({ line, exactKeywords, near, firedTitles });
    }
    setTurns(out);
    setStatus(
      `Replayed ${lines.length} line${lines.length === 1 ? "" : "s"}` +
        (skipped ? ` · skipped ${skipped} junk line${skipped === 1 ? "" : "s"}` : ""),
    );
  };

  const onFile = (file: File): void => {
    void file.text().then((text) => {
      const parsed = parseChatJsonl(text);
      if (parsed.lines.length === 0) {
        setStatus("No chat lines found in that file.");
        setTurns([]);
        return;
      }
      runLines(parsed.lines, parsed.skipped);
    });
  };

  return (
    <div className={styles.playback}>
      <label className={styles.drop}>
        <input
          type="file"
          accept=".jsonl,.json,text/plain"
          aria-label="Open chat export"
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (f) onFile(f);
            ev.target.value = "";
          }}
        />
        Drop or pick a SillyTavern chat export (.jsonl)
      </label>
      {status && <p className={styles.empty}>{status}</p>}
      <div className={styles.chat}>
        <VirtualRows items={turns} keyOf={(_, i) => String(i)} estimate={TURN_ESTIMATE_PX} gap={TURN_GAP_PX} render={(t) => (
          <div className={t.line.role === "user" ? styles.rowUser : styles.rowBot}>
            <div className={t.line.role === "user" ? styles.user : styles.bot}>
              <PlaybackLine text={t.line.text} exact={t.exactKeywords} near={t.near} onJump={onJumpEntry} />
              {t.firedTitles.length > 0 && (
                <div className={styles.firedList}>
                  Fired: {t.firedTitles.join(", ")}
                </div>
              )}
            </div>
          </div>
        )} />
      </div>
    </div>
  );
}

function PlaybackLine({
  text,
  exact,
  near,
  onJump,
}: {
  text: string;
  exact: string[];
  near: { word: string; keys: string[]; entryIds: string[] }[];
  onJump: (id: string) => void;
}): JSX.Element {
  const exactLower = new Set(exact.map((k) => k.toLowerCase()));
  const nearByWord = new Map(near.map((n) => [n.word.toLowerCase(), n]));
  const parts = text.split(/(\s+|[.,!?;"'()])/g);

  return (
    <span>
      {parts.map(/* bounded-ok: fixed category set, per-item detail, capped or short by construction */ (part, i) => {
        const lower = part.toLowerCase();
        if (exactLower.has(lower) || [...exactLower].some((k) => lower.includes(k) && k.length > 2 && part.toLowerCase() === k)) {
          return (
            <mark key={i} className={styles.exact}>
              {part}
            </mark>
          );
        }
        // also mark if any exact keyword appears as whole token match
        for (const k of exact) {
          if (part.toLowerCase() === k.toLowerCase()) {
            return (
              <mark key={i} className={styles.exact}>
                {part}
              </mark>
            );
          }
        }
        const n = nearByWord.get(lower);
        if (n) {
          return (
            <InlineValue
              key={i}
              title={`Close to: ${n.keys.join(", ")}`}
              onClick={() => {
                const id = n.entryIds[0];
                if (id) onJump(id);
              }}
            >
              {part}
            </InlineValue>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
