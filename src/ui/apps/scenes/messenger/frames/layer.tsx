/**
 * The Messenger workshop layer (approved wireframe messenger-discord/panels.html section 0, settings.html): a full overlay inside the Messenger root, the Discord settings pattern.
 * It owns the modal behavior and nothing else: role dialog, a Tab trap, Escape (through the shared arbiter, so an Escape a field already spent does not close it) and the close circle
 * with its ESC caption. The content is the caller's.
 */
import { useRef, type JSX, type ReactNode } from "react";
import { useFocusTrap } from "../../../../_shared/focus-trap";
import { Ic } from "../../../../_shared/ic";
import { useDialogEscape } from "../../../../_shared/use-escape-key";
import { IconButton } from "../../../../components/button";

export interface LayerProps {
  /** spoken name of the dialog ("Character settings") */
  label: string;
  onClose(): void;
  children: ReactNode;
}

export function Layer({ label, onClose, children }: LayerProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  useDialogEscape(ref, onClose);
  return (
    <div ref={ref} className="msn-layer" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} data-part="scene.messenger.layer">
      {children}
      <IconButton data-msn-close="" data-part="scene.messenger.layer.close" label="Close" icon={<><Ic name="lucide:x" /><small>ESC</small></>} onClick={onClose} />
    </div>
  );
}
