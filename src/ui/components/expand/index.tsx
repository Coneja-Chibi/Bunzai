/**
 * ExpandBox - the fullscreen affordance every multi-line editor in the Studio wears. Collapsed it is
 * the editor exactly as its own stylesheet drew it, plus a corner control; expanded, the SAME editor
 * element moves into a full-viewport modal sheet so a long prompt can be read without a 3-line well.
 *
 * The editor moves rather than duplicates (two live textareas over one value is a data-loss bug
 * waiting to happen), so the DOM node is recreated by the swap and the caret has to be carried across
 * by hand - that is what expand-core's caret helpers are for. ExpandTextarea is the drop-in for the
 * common case: a plain textarea whose value lives in its parent.
 */
import { Button } from "../button";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { JSX, ReactNode, TextareaHTMLAttributes } from "react";
import { DialogCore } from "../dialog-core";
import { applyCaret, readCaret, type Caret } from "./expand-core";
import styles from "./styles.module.css";

/** the text control the box is wrapping: the first one inside the frame, either side of the swap. */
const editorIn = (root: HTMLElement | null): HTMLTextAreaElement | null => root?.querySelector("textarea") ?? null;

export interface ExpandBoxProps {
  /** names the editor on the control and as the dialog's title ("Block content") */
  label: string;
  children: ReactNode;
  /** fires on every toggle; editors with caret-anchored popovers use it to drop stale overlays */
  onExpandedChange?: (expanded: boolean) => void;
}

/** Wraps one editor with an expand control and the fullscreen sheet it expands into. */
export function ExpandBox({ label, children, onExpandedChange }: ExpandBoxProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const inlineRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const caretRef = useRef<Caret | null>(null);
  const everOpened = useRef(false);
  const titleId = useId();

  const open = useCallback((): void => {
    const ta = editorIn(inlineRef.current);
    caretRef.current = ta ? readCaret(ta) : null;
    setExpanded(true);
    onExpandedChange?.(true);
  }, [onExpandedChange]);

  const close = useCallback((): void => {
    const ta = editorIn(sheetRef.current);
    caretRef.current = ta ? readCaret(ta) : null;
    setExpanded(false);
    onExpandedChange?.(false);
  }, [onExpandedChange]);

  // The swap has happened by the time this runs, so the ref points at the new element.
  useEffect(() => {
    const caret = caretRef.current;
    caretRef.current = null;
    if (expanded) {
      everOpened.current = true;
      const ta = editorIn(sheetRef.current);
      if (!ta) return;
      ta.focus();
      if (caret) applyCaret(ta, caret);
      return;
    }
    if (!everOpened.current) return; // first render: nothing was open, so nothing may steal focus
    everOpened.current = false;
    // Closing owes two things at once: the caret goes back to the inline editor, but FOCUS goes back
    // to the control the user pressed, which is where a keyboard user expects to be standing. So set
    // the range without focusing - the caret is already correct the moment they click or tab back in.
    const ta = editorIn(inlineRef.current);
    if (ta && caret) applyCaret(ta, caret);
    triggerRef.current?.focus();
  }, [expanded]);

  return (
    <div ref={inlineRef} className={styles.frame}>
      {expanded ? <div className={styles.away}>Editing fullscreen</div> : children}
      <span className={styles.inlineToggle}>
        <Button
          size="sm"
          variant="quiet"
          ref={triggerRef}
          onClick={open}
          aria-expanded={expanded}
          aria-label={`Expand ${label}`}
        >
          Expand
        </Button>
      </span>
      {expanded &&
        <DialogCore
          placement="fullscreen"
          onDismiss={close}
          ariaLabel={label}
          labelledBy={titleId}
          portal
          overlayClassName={styles.scrim}
          className={styles.sheet}
          sheetRef={sheetRef}
          tabIndex={-1}
          dismissOnScrim={false}
        >
              <div className={styles.head}>
                <span className={styles.title} id={titleId}>
                  {label}
                </span>
                <span className={styles.hint}>Esc closes</span>
                <Button size="sm" variant="quiet" onClick={close} aria-label={`Collapse ${label}`}>
                  Collapse
                </Button>
              </div>
              <div className={styles.body}>{children}</div>
        </DialogCore>
      }
    </div>
  );
}

export interface ExpandTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** names the editor on the control and as the dialog's title */
  label: string;
}

/** A textarea that can go fullscreen: drop-in for a raw one, same props, same value ownership. */
export function ExpandTextarea({ label, ...rest }: ExpandTextareaProps): JSX.Element {
  return (
    <ExpandBox label={label}>
      <textarea {...rest} />
    </ExpandBox>
  );
}
