/** Current-page heading rail, derived entirely from generated docs anchors. */
import { ListRow } from "../../components/button";
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
        <ListRow
          key={`${anchor.slug}-${anchor.level}`}
          depth={anchor.level >= 3 ? 1 : 0}
          selected={activeSlug === anchor.slug}
          aria-current={activeSlug === anchor.slug ? "location" : undefined}
          onClick={() => onJump(anchor.slug)}
          label={anchor.text}
        />
      ))}
    </aside>
  );
}
