/** scenes.list table-of-contents: every scene is a chapter entry, its number and title, a dotted leader and the message count. */
import type { JSX } from "react";
import type { SceneRowProps } from "../../scene-row";
import styles from "./table-of-contents.module.css";

export default function ContentsEntry({ s, index, ago, takes }: SceneRowProps): JSX.Element {
  return (
    <span className={styles.entry}>
      <span className={styles.no}>{index}.</span>
      <span className={styles.title}>{s.title}</span>
      <span className={styles.leader} aria-hidden="true" />
      <span className={styles.folio}>{s.messageCount} {s.messageCount === 1 ? "msg" : "msgs"}</span>
      <span className={styles.sub}>{s.characterName}, {ago.long}{takes.pips > 1 || takes.overflow > 0 ? `, ${takes.label}` : ""}</span>
    </span>
  );
}
