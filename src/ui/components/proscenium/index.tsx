/** A reusable miniature theater frame with a hanging sign, separate artwork and live content. */
import type { JSX, ReactNode } from "react";
import { docAssetUrl } from "../../_shared/asset-url";
import styles from "./styles.module.css";

export function Proscenium({ label, art, children }: { label: string; art: ReactNode; children: ReactNode }): JSX.Element {
  return <section className={styles.frame} aria-label={label}>
    <div className={styles.inset}>
      <div className={styles.screen}>{art}</div>
      <div className={styles.content}>{children}</div>
    </div>
    <img className={styles.overlay} src={docAssetUrl("docs/media/now-playing-proscenium.png")} alt="" aria-hidden="true" decoding="async" />
  </section>;
}
