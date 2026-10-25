/** Current-page heading rail, derived entirely from generated docs anchors. */
import type { JSX } from "react";
import type { DocAnchor } from "../../docs-types";
import { flattenAnchors } from "../../../kit/docs/navigation";
import styles from "./styles.module.css";

interface DocTocProps {
  anchors: DocAnchor[];
  activeSlug: string;
  onJump(slug: string): void;
}

export function DocToc({ anchors, activeSlug, onJump }: DocTocProps): JSX.Element {
  const flat = flattenAnchors(anchors);
  return (
    <aside className={styles.toc} aria-label="On this page" data-tour="toc">
      {flat.length > 0 && <div className={styles.tocHead}>On this page</div>}
      {flat.map((anchor) => (
        <button
          key={`${anchor.slug}-${anchor.level}`}
          type="button"
          className={`${styles.tocLink}${anchor.level >= 3 ? ` ${styles.sub}` : ""}${activeSlug === anchor.slug ? ` ${styles.on}` : ""}`}
          onClick={() => onJump(anchor.slug)}
        >
          {anchor.text}
        </button>
      ))}
    </aside>
  );
}
