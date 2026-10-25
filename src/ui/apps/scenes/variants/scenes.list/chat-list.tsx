/** scenes.list chat-list: every scene is a conversation, an avatar, the character, a one-line preview and a time. */
import type { JSX } from "react";
import type { SceneRowProps } from "../../scene-row";
import styles from "./chat-list.module.css";

export default function ChatRow({ s, art, ago, takes }: SceneRowProps): JSX.Element {
  return (
    <span className={styles.row}>
      <span className={styles.avatar}>{art}</span>
      <span className={styles.body}>
        <span className={styles.name}>{s.characterName}</span>
        <span className={styles.preview}>{s.title}{takes.pips > 1 || takes.overflow > 0 ? ` · ${takes.label}` : ""}</span>
      </span>
      <span className={styles.side}>
        <span className={styles.time}>{ago.short}</span>
        <span className={styles.count} role="img" aria-label={`${s.messageCount} ${s.messageCount === 1 ? "message" : "messages"}`}>{s.messageCount}</span>
      </span>
    </span>
  );
}
