/**
 * The Messenger side panel: docks to the right of the chat, Side (360px) or Wide (640px), with a header of title, pin, pop out and close, and the children as its body (panels.html section 0).
 * Presentational: the open panel, its pin and its callbacks belong to the shell. Esc inside the panel closes it, as the wireframe's keyboard note says.
 */
import type { JSX, KeyboardEvent, ReactNode } from "react";
import { IconButton } from "../../../../components/button";
import { isEscapeClose } from "../../../../_shared/use-escape-key";

export type PanelWidth = "side" | "wide";

export interface SidePanelProps {
  /** the panel's name, shown in the header and used to label the region */
  title: string;
  /** a quiet scope line under the title */
  subtitle?: string;
  width?: PanelWidth;
  /** pinned panels stay open while the person switches scenes */
  pinned?: boolean;
  onTogglePin?: () => void;
  onPopOut?: () => void;
  onClose: () => void;
  children?: ReactNode;
}

export function SidePanel({ title, subtitle, width = "side", pinned = false, onTogglePin, onPopOut, onClose, children }: SidePanelProps): JSX.Element {
  const onKeyDown = (e: KeyboardEvent<HTMLElement>): void => {
    if (!isEscapeClose(e.nativeEvent)) return;
    e.stopPropagation();
    onClose();
  };
  return (
    <section className="msn-pnl" data-part="scene.messenger.panel.side" data-width={width} aria-label={title} onKeyDown={onKeyDown}>
      <header className="msn-pnl-h" data-part="scene.messenger.panel.header">
        <div className="msn-pnl-t"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</div>
        {onTogglePin && <IconButton data-part="scene.messenger.panel.pin" variant="quiet" size="sm" icon="lucide:pin" label={pinned ? "Unpin panel" : "Pin panel"} aria-pressed={pinned} onClick={onTogglePin} />}
        {onPopOut && <IconButton data-part="scene.messenger.panel.popout" variant="quiet" size="sm" icon="lucide:external-link" label="Pop out" onClick={onPopOut} />}
        <IconButton data-part="scene.messenger.panel.close" variant="quiet" size="sm" icon="lucide:x" label="Close panel" onClick={onClose} />
      </header>
      <div className="msn-pnl-b" data-part="scene.messenger.panel.body">{children}</div>
    </section>
  );
}
