/**
 * KeywordChips - RC-dense trigger chips. Enter/comma commits; Backspace on empty input
 * drops the last chip. Advanced mode shows per-key % on the chip (RC per-trigger %).
 */
import { Chip, IconButton } from "../../../components/button";
import { useState, type JSX, type KeyboardEvent } from "react";
import type { Trigger } from "../../../../entities/lorebook/schema";

export interface KeywordChipsProps {
  triggers: Trigger[];
  onChange: (next: Trigger[]) => void;
  styles: Readonly<Record<string, string>>;
  placeholder?: string;
  ariaLabel: string;
  /** advanced: chip pick + inline probability */
  advanced?: boolean;
  pickedIndex?: number | null;
  onPick?: (index: number) => void;
  /** entry-level fallback shown when a trigger has no own probability */
  entryProbability?: number;
}

export function KeywordChips({
  triggers,
  onChange,
  styles,
  placeholder,
  ariaLabel,
  advanced = false,
  pickedIndex,
  onPick,
  entryProbability = 100,
}: KeywordChipsProps): JSX.Element {
  const [draft, setDraft] = useState("");

  const commit = (): void => {
    const keyword = draft.trim().replace(/,+$/, "").trim();
    setDraft("");
    if (!keyword) return;
    if (triggers.some((t) => t.keyword === keyword)) return;
    const t: Trigger = { keyword, isRegex: false };
    if (advanced) t.probability = entryProbability;
    onChange([...triggers, t]);
  };

  const onKey = (ev: KeyboardEvent<HTMLInputElement>): void => {
    if (ev.key === "Enter" || ev.key === ",") {
      ev.preventDefault();
      commit();
      return;
    }
    if (ev.key === "Backspace" && draft === "" && triggers.length > 0) {
      ev.preventDefault();
      onChange(triggers.slice(0, -1));
    }
  };

  const setChance = (i: number, probability: number): void => {
    onChange(triggers.map((t, j) => (j === i ? { ...t, probability } : t)));
  };

  return (
    <div className={styles.keybox} role="group" aria-label={ariaLabel}>
      {triggers.map(/* bounded-ok: tabs, ports, options, chips and per-item detail inside one document */ (t, i) => (
        <span
          key={`${t.keyword}-${i}`}
          className={i === pickedIndex ? `${styles.key} ${styles.keyPicked}` : styles.key}
        >
          {onPick ? (
            <Chip pressed={i === pickedIndex} title="Edit this key's dials" onClick={() => onPick(i)}>{t.isRegex ? `/${t.keyword}/` : t.keyword}</Chip>
          ) : (
            <span className={styles.keyLabel}>{t.isRegex ? `/${t.keyword}/` : t.keyword}</span>
          )}
          {advanced && (
            <input
              className={styles.keyPct}
              type="number"
              min={0}
              max={100}
              value={t.probability ?? entryProbability}
              aria-label={`${t.keyword} chance percent`}
              title="Per-key activation chance"
              onChange={(ev) => setChance(i, Number(ev.target.value) || 0)}
              onClick={(ev) => ev.stopPropagation()}
            />
          )}
          <IconButton label={`remove ${t.keyword}`} variant="quiet" size="sm" icon="lucide:x" onClick={() => onChange(triggers.filter((_, j) => j !== i))} />
        </span>
      ))}
      <input
        className={styles.keyin}
        value={draft}
        placeholder={placeholder ?? "add a word…"}
        aria-label={ariaLabel}
        onChange={(ev) => setDraft(ev.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
      />
    </div>
  );
}
