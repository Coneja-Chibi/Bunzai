/**
 * RoomHeader - the one header every room wears (approved Premiere wireframes, design/wireframes/premiere/): a gold
 * kicker line, the room title in the display face and one line of lede, with the room's own actions at the right.
 * Colors come from the theme's roles, so the header follows the user's accent; numbers inside the title switch to
 * the UI face because the display face draws 1 like a capital I.
 */
import type { JSX, ReactNode } from "react";
import { digitRuns } from "../../_shared/digit-runs";
import styles from "./styles.module.css";

export interface RoomHeaderProps {
  /** the small gold line above the title, e.g. "Convert files" */
  kicker?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  /** the room's own header controls, right-aligned */
  actions?: ReactNode;
  /** centered marquee (Library, Apps) instead of the default left playbill */
  align?: "left" | "center";
  /** the room's data-part for its header, e.g. "press.header" */
  "data-part"?: string;
}

/** Digits in a string title leave the display face, which draws 1 like a capital I. */
const titleText = (title: ReactNode): ReactNode => (typeof title === "string" ? digitRuns(title, styles.num) : title);

export function RoomHeader({ kicker, title, lede, actions, align = "left", "data-part": part }: RoomHeaderProps): JSX.Element {
  return (
    <header className={styles.header} data-control="room-header" data-align={align} data-part={part}>
      <div className={styles.text}>
        {kicker ? <span className={styles.kicker} data-slot="kicker">{kicker}</span> : null}
        <h1 className={styles.title} data-slot="title">{titleText(title)}</h1>
        {lede ? <p className={styles.lede} data-slot="lede">{lede}</p> : null}
      </div>
      {actions ? <div className={styles.actions} data-slot="actions">{actions}</div> : null}
    </header>
  );
}
