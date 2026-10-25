/** Shared square floating widget frame; app folders own the content and actions. */
import type { ReactNode } from "react";
import "./styles.css";

export function OverlayWidget({ title, children }: { title: string; children: ReactNode }) {
  return <section className="overlay-widget" aria-label={title} data-part="shell.overlay.widget">
    <header><h3>{title}</h3></header><div className="overlay-widget-content">{children}</div>
  </section>;
}
