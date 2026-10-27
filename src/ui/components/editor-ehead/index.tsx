/**
 * EditorEhead - the shared editor header bar (spine chip + name + meta on the left, editor-specific
 * middle + Save on the right). Extracted from four hand-rolled copies (regex / persona / lorebook,
 * and now preset) that had drifted (raw --rose vs --stage-rose-well save, 12rem vs 14rem name).
 * The MIDDLE is per-editor (a WriteForStrip, a view switch + lens dropdown): passed as children.
 *
 * The name is an editable input when `onNameChange` is given (regex/persona/preset) and read-only
 * display text otherwise (lorebook edits its name elsewhere). `meta` is a ReactNode so an editor can
 * embed an inline control (the lorebook's "book rules" link).
 */
import { Button } from "../button";
import { Children, Fragment, isValidElement } from "react";
import type { CSSProperties, JSX, ReactNode } from "react";
import { deckMeta } from "../../_shared/decks";
import s from "./styles.module.css";

/** a kind id from the kind hub; its deck color fills the monogram tile. */
export type EditorEheadDeck = string;

/** Set digit runs in the mono face (numbers are mono, words are not); elements pass through untouched. */
function monoNumbers(node: ReactNode): ReactNode {
  if (typeof node === "string") {
    return node.split(/(\d+)/).map((part, i) =>
      i % 2 === 1 ? <span key={i} className={s.num}>{part}</span> : part,
    );
  }
  if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) {
    return <>{Children.map(node.props.children, monoNumbers)}</>;
  }
  return node;
}

export interface EditorEheadProps {
  /** the spine monogram (first letter / kind glyph) */
  mark: string;
  /** the gold kind kicker above the name ("Preset"); absent => no kicker */
  kind?: string;
  /** the piece kind's deck color for the monogram tile; absent => the accent */
  deck?: EditorEheadDeck;
  name: string;
  /** present => editable input; absent => read-only display */
  onNameChange?: (next: string) => void;
  namePlaceholder?: string;
  nameAriaLabel?: string;
  /** the meta line under the name; ReactNode so editors can embed inline controls */
  meta: ReactNode;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  saveTitle?: string;
  /** the editor-specific middle: lens control / view switch. */
  children?: ReactNode;
  /** the pane's top-right slot (close, split...). */
  topRight?: ReactNode;
}

export function EditorEhead({
  mark,
  kind,
  deck,
  name,
  onNameChange,
  namePlaceholder,
  nameAriaLabel,
  meta,
  dirty,
  saving,
  onSave,
  saveTitle = "Save · ctrl+s",
  children,
  topRight,
}: EditorEheadProps): JSX.Element {
  return (
    <header className={s.ehead} data-editor="head" data-deck={deck} style={deck ? ({ "--deck-tile": deckMeta(deck).accent } as CSSProperties) : undefined}>
      <div className={s.spine}>
        <span className={s.spineMark}>{mark}</span>
        <div className={s.spineText}>
          {kind ? <span className={s.kind}>{kind}</span> : null}
          {onNameChange ? (
            <input
              className={s.spineName}
              value={name}
              placeholder={namePlaceholder}
              aria-label={nameAriaLabel}
              onChange={(e) => onNameChange(e.target.value)}
            />
          ) : (
            <b className={s.spineName}>{name}</b>
          )}
          <span className={s.spineMeta}>{monoNumbers(meta)}</span>
        </div>
      </div>
      <span className={s.acts}>
        {children}
        <Button
          size="sm"
          variant="primary"
          disabled={saving || !dirty}
          onClick={onSave}
          title={saveTitle}
        >
          {saving ? "Saving…" : dirty ? "Save" : "Saved"}
        </Button>
        {topRight}
      </span>
    </header>
  );
}
