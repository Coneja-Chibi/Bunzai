/** Shell-owned confirmation before closing an editor that still has unsaved changes. */
import type { JSX } from "react";
import { Button } from "../components/button";
import { InkDialog } from "../components/ink-dialog";
import { useShellStore } from "./store";

interface ClosePiecePromptProps {
  name: string;
  onDiscard(): void;
  onKeep(): void;
}

export function ClosePiecePrompt({
  name,
  onDiscard,
  onKeep,
}: ClosePiecePromptProps): JSX.Element {
  return (
    <>
      <p className="msg">{name} has unsaved changes. Close this tab and discard them?</p>
      <div className="actions">
        <Button variant="danger" onClick={onDiscard}>
          Discard changes
        </Button>
        <Button autoFocus onClick={onKeep}>
          Keep editing
        </Button>
      </div>
    </>
  );
}

export function ClosePieceDialog(): JSX.Element | null {
  const piece = useShellStore((state) => state.pendingClose);
  const answer = useShellStore((state) => state.answerPieceClose);
  if (!piece) return null;

  return (
    <InkDialog ariaLabel="Discard unsaved changes?" onDismiss={() => answer(false)} sheetClassName="vdialog">
      <ClosePiecePrompt
        name={piece.name}
        onDiscard={() => answer(true)}
        onKeep={() => answer(false)}
      />
    </InkDialog>
  );
}
