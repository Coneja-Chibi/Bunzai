/**
 * The edit textarea of a message (RoleCall EditableMessage): Escape cancels, Ctrl or Cmd+Enter
 * saves, the box grows with its text. The Escape press is consumed here (preventDefault) so the
 * document-level Escape arbiter (_shared/use-escape-key.ts) never also stops a running reply.
 */
import { useLayoutEffect, useRef, type JSX } from "react";
import { isEscapeClose } from "../../_shared/use-escape-key";

export function EditBox({ value, onChange, onSave, onCancel }: { value: string; onChange(text: string): void; onSave(): void; onCancel(): void }): JSX.Element {
  const box = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea ref={box} autoFocus value={value} aria-label="Edit message" onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (isEscapeClose(e.nativeEvent)) { e.preventDefault(); onCancel(); }
        else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSave(); }
      }} />
  );
}
