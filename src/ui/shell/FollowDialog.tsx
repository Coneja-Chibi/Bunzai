/**
 * FollowDialog - the shell's "N items were sent to the Workbench. Follow?" prompt (transcribed
 * from the old boot.ts's askFollow), rebuilt on the InkDialog seed. Renders only when the store
 * carries a followPrompt; Yes/No answer through `answerFollow`, and the checkbox makes the answer
 * permanent (changeable later in Settings).
 */
import { useState } from "react";
import type { JSX } from "react";
import { Button } from "../components/button";
import { InkDialog } from "../components/ink-dialog";
import { useShellStore } from "./store";

export function FollowDialog(): JSX.Element | null {
  const prompt = useShellStore((s) => s.followPrompt);
  const answerFollow = useShellStore((s) => s.answerFollow);
  const [remember, setRemember] = useState(false);

  if (!prompt) return null;

  const answer = (follow: boolean): void => {
    answerFollow(follow, remember);
    setRemember(false);
  };

  return (
    <InkDialog ariaLabel="Follow to the Workbench?" onDismiss={() => answer(false)} sheetClassName="vdialog">
      <p className="msg">
        {prompt.count} {prompt.count === 1 ? "item was" : "items were"} sent to the Workbench. Follow?
      </p>
      <label className="remember">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Never ask me this again
      </label>
      <div className="actions">
        <Button variant="primary" autoFocus onClick={() => answer(true)}>
          Yes
        </Button>
        <Button onClick={() => answer(false)}>
          No
        </Button>
      </div>
    </InkDialog>
  );
}
