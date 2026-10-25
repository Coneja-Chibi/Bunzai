/** scenes.list save-file-slots: every scene is a numbered save slot, a thumbnail, its details and a load arrow. */
import type { JSX } from "react";
import type { SceneRowProps } from "../../scene-row";
import styles from "./save-file-slots.module.css";

export default function SaveFileSlot({ s, index, art, ago, takes }: SceneRowProps): JSX.Element {
  return (
    <span className={styles.slot}>
      <span className={styles.no}><small>Slot</small>{String(index).padStart(2, "0")}</span>
      <span className={styles.thumb}>{art}</span>
      <span className={styles.body}>
        <span className={styles.title}>{s.title}</span>
        <span className={styles.meta}>{s.characterName} · {s.messageCount} {s.messageCount === 1 ? "msg" : "msgs"} · {ago.long}</span>
      </span>
      <span className={styles.take}>
        <span className={styles.pips} aria-hidden="true">{Array.from({ length: takes.pips }, (_, i) => <i key={i} className={i === takes.on ? styles.on : undefined} />)}{takes.overflow > 0 && <b>+{takes.overflow}</b>}</span>
        <small>{takes.label}</small>
      </span>
      <span className={styles.load} aria-hidden="true">Load &rarr;</span>
    </span>
  );
}
