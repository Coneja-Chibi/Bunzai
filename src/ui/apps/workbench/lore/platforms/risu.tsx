/**
 * Risu lore long tail: folder id. Codec: formats/risu/lorebook.ts.
 */
import type { JSX } from "react";
import { fieldOr, useFramed } from "../../framed";
import type { LorePlatformCard, LorePlatformCardProps } from "./card-contract";

function Component({ entry, show, styles, onPatch }: LorePlatformCardProps): JSX.Element | null {
  const themed = useFramed();
  if (!show("categoryId")) return null;
  return (
    <div className={styles.pcZone}>
      <div className={styles.pcZh}>
        <b>Folder</b>
        <span>Risu folder this entry belongs to</span>
      </div>
      {fieldOr(themed, { label: "Folder id" }, (
        <input
          className={styles.pcText}
          style={{ width: "100%", maxWidth: "none" }}
          value={entry.categoryId ?? ""}
          aria-label="Folder id"
          title="Risu folder this entry belongs to"
          onChange={(ev) => onPatch({ categoryId: ev.target.value || null })}
        />
      ), (c) => (
        <div className={styles.pcChrome}>
          <span className={styles.pcK}>Folder id</span>
          {c}
        </div>
      ))}
    </div>
  );
}

const card: LorePlatformCard = {
  id: "risu",
  label: "Risu",
  lenses: ["risu"],
  Component,
};

export default card;
