/** @jsxImportSource @opentui/react */
/**
 * ThoughtBox, the open rehearsal (DECISIONS #25): while the model reasons, its live thought streams
 * in a dim seam-bordered box. A slim uppercase REHEARSAL header wears the deep-rose stamp clock
 * (whole-turn elapsed) at its right. The stagehand never shares the stage with this box. Capped to
 * the freshest slice of the thought; the full text lands in the transcript when it bows out.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { tailGraphemes } from "../../_shared/graphemes";
import { useTick } from "./use-tick";
import { ElapsedStamp } from "./elapsed-stamp";

const TAIL_CHARS = 380; // roughly six rows of a typical pane

export function ThoughtBox({ text, startedAt }: { text: string; startedAt: number }): ReactNode {
  useTick(250);
  const tail = tailGraphemes(text, TAIL_CHARS);
  return (
    <box flexDirection="column" border borderColor={theme.line} backgroundColor={theme.floor}>
      <box flexDirection="row" backgroundColor={theme.floor} paddingLeft={1} paddingRight={1}>
        <text fg={theme.mut}>REHEARSAL</text>
        <box flexGrow={1} />
        <ElapsedStamp ms={Date.now() - startedAt} />
      </box>
      <box paddingLeft={1} paddingRight={1}>
        <text fg={theme.mut}>{tail || "..."}</text>
      </box>
    </box>
  );
}
