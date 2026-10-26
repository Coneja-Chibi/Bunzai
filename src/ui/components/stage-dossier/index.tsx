/**
 * The stage dossier: RoleCall's encryption-flow grammar for Bunraku's own screens (the approved
 * in-between wireframes in design/wireframes/encryption/in-between/). The Security settings and the
 * stage door are built from these pieces: a dossier with an act label and a marquee, a stage
 * direction, the lines box, the cue grid for typing words back, and the warning and error plates.
 */
import { Button } from "../button";
import { useRef } from "react";
import type { ChangeEvent, ClipboardEvent, JSX, ReactNode } from "react";
import styles from "./styles.module.css";

/** A dossier: the act label, a marquee with one colored word, the flourish, then the body. */
export function Dossier({
  act,
  title,
  accent,
  hero,
  children,
}: {
  act: string;
  /** the marquee's plain words, before the colored one */
  title: string;
  /** the one colored word (or words) at the end of the marquee */
  accent?: string;
  hero?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={hero ? `${styles.dossier} ${styles.hero}` : styles.dossier}>
      <div className={styles.head}>
        <div className={styles.act}>{act}</div>
        <h2 className={styles.marquee}>
          {title}
          {accent ? (
            <>
              {" "}
              <em>{accent}</em>
            </>
          ) : null}
        </h2>
        <div className={styles.flourish} aria-hidden="true">
          {"✦"}
        </div>
      </div>
      {children}
    </div>
  );
}

/** The parenthesised stage direction: the one theatrical aside, in plain words. */
export function Direction({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p className={styles.direction}>
      <span className={styles.paren}>(</span>
      {children}
      <span className={styles.paren}>)</span>
    </p>
  );
}

/** One line of voice, centered. */
export function Voice({ children }: { children: ReactNode }): JSX.Element {
  return <p className={styles.voice}>{children}</p>;
}

/** STAGE DIRECTION (a warning, gilt) or LINE FLUB (an error). */
export function StageNote({ label, tone, children }: { label: string; tone: "warn" | "flub"; children: ReactNode }): JSX.Element {
  return (
    <div className={tone === "warn" ? `${styles.note} ${styles.gilt}` : styles.note} role={tone === "flub" ? "alert" : undefined}>
      <div className={styles.noteLabel}>{label}</div>
      <p>{children}</p>
    </div>
  );
}

/** The lines box with its accent spine. */
export function Lines({ heading, children }: { heading: string; children: ReactNode }): JSX.Element {
  return (
    <div className={styles.lines}>
      <div className={styles.linesHead}>{`▸ ${heading}`}</div>
      {children}
    </div>
  );
}

/** Numbered words, shown to be written down. */
export function WordList({ words }: { words: readonly string[] }): JSX.Element {
  return (
    <div className={styles.lineGrid}>
      {words.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (w, i) => (
        <div className={styles.line} key={i}>
          <i>{`${i + 1}.`}</i>
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}

/** Splits pasted or typed text into words, lower case, no punctuation. */
export const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

/**
 * The cue grid: twelve inputs for typing the words back. Pasting all twelve into any cue fills the
 * grid from there. `flubbed` marks the cues that are off.
 */
export function CueGrid({
  values,
  onChange,
  flubbed = [],
  label = "Your cues",
}: {
  values: readonly string[];
  onChange: (next: string[]) => void;
  flubbed?: readonly number[];
  label?: string;
}): JSX.Element {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (at: number, word: string): void => {
    const next = [...values];
    next[at] = word;
    onChange(next);
  };
  const onPaste = (at: number) => (e: ClipboardEvent<HTMLInputElement>): void => {
    const words = wordsOf(e.clipboardData.getData("text"));
    if (words.length < 2) return;
    e.preventDefault();
    const next = [...values];
    words.slice(0, values.length - at).forEach((w, i) => (next[at + i] = w));
    onChange(next);
    refs.current[Math.min(at + words.length, values.length - 1)]?.focus();
  };
  const delivered = values.filter((v) => v.trim()).length;
  return (
    <Lines heading={label}>
      <div className={styles.lineGrid}>
        {values.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (v, i) => (
          <label className={flubbed.includes(i) ? `${styles.cue} ${styles.flubbed}` : styles.cue} key={i}>
            <i>{`${i + 1}.`}</i>
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={v}
              aria-label={`Word ${i + 1}`}
              aria-invalid={flubbed.includes(i) || undefined}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e: ChangeEvent<HTMLInputElement>) => set(i, e.target.value.trim().toLowerCase())}
              onPaste={onPaste(i)}
            />
          </label>
        ))}
      </div>
      <div className={styles.cuesCount}>{`${delivered} / ${values.length} cues delivered`}</div>
    </Lines>
  );
}

/**
 * A password field no password manager is invited to keep: the library's password is the key to
 * everything in it, and a saved copy would sit in a browser store that may sync to the cloud. Not in
 * a form (a submitted form is what prompts to save), autocomplete off, and the opt-out markers the
 * common managers honor. Enter still submits.
 */
export function SecretField({ id, label, value, onChange, onEnter, invalid }: { id: string; label: string; value: string; onChange: (v: string) => void; onEnter?: () => void; invalid?: boolean }): JSX.Element {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={invalid ? `${styles.input} ${styles.bad}` : styles.input}
        type="password"
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore="true"
        data-bwignore="true"
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
      />
    </div>
  );
}

/** The pledge checkbox. */
export function Pledge({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }): JSX.Element {
  return (
    <label className={styles.pledge}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** The big call to action (a full-width Stamp) and, optionally, quiet ways out beside it. */
export function StageActions({
  cta,
  onCta,
  disabled,
  children,
}: {
  cta: string;
  onCta: () => void;
  disabled?: boolean;
  /** the quiet choices: GhostButtons */
  children?: ReactNode;
}): JSX.Element {
  return (
    <div className={`${styles.actions} ${styles.noPrint}`}>
      <div className={styles.cta}>
        <Button variant="primary" block onClick={onCta} disabled={disabled}>
          {`${cta} →`}
        </Button>
      </div>
      {children}
    </div>
  );
}

/** A quiet choice: the dashed button that never competes with the call to action. */
export function GhostButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }): JSX.Element {
  return (
    <Button size="sm" variant="quiet" onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}
