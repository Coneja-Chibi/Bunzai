/**
 * Panel - the one framed surface rooms use (approved Premiere wireframes): a hard frame with an offset shadow and an
 * optional deck-color top edge for a piece kind. One frame per group: a Panel inside a Panel drops its frame, fill and
 * shadow and keeps only its colored top edge (styles.module.css), so boxes never nest.
 */
import type { HTMLAttributes, JSX, ReactNode } from "react";
import styles from "./styles.module.css";

export type PanelDeck = "character" | "persona" | "lorebook" | "preset" | "regex" | "pack" | "fog";

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  children: ReactNode;
  /** a piece kind's deck color on the top edge */
  deck?: PanelDeck;
  /** the element to render; a section by default */
  as?: "section" | "div" | "article" | "aside";
  /** the room's data-part for this panel */
  "data-part"?: string;
}

export function Panel({ children, deck, as: Tag = "section", "data-part": part, className, ...rest }: PanelProps): JSX.Element {
  return (
    <Tag {...rest} className={[styles.panel, className].filter(Boolean).join(" ") || undefined} data-control="panel" data-deck={deck} data-part={part}>
      {children}
    </Tag>
  );
}
