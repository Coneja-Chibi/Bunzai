/**
 * The "Your own tags" rows of Catch thinking (Full Chat: generation/catch-thinking.tsx, shown while the mode is Only these): each own opening and closing text, Remove, and "Add your own tag" up to the limit. They are
 * written into `capture.custom` like the Generation tab writes them, blank rows kept while they are being typed, and typing an opening tag fills the matching closing one while that is empty or was the automatic one.
 */
import type { JSX } from "react";
import { CAPTURE_MAX_CUSTOM, CAPTURE_MAX_LENGTH, closingForOpening, normalizeCapture, type CaptureDelimiter } from "../../../../../../core/reasoning-capture";
import type { PromptingView } from "../../../generation/use-prompting-view";
import { ActionRow } from "../../frames/settings-rows";
import { CheckedText } from "./drafts";

const WHAT = "Catch thinking";

export function CustomTagRows({ prompting }: { prompting: PromptingView }): JSX.Element {
  const { view, write } = prompting;
  const capture = normalizeCapture(view.capture);
  // Own rows still being typed (blank) are kept, which normalizing would drop.
  const custom = view.capture?.custom ?? capture.custom;
  const put = (next: CaptureDelimiter[]): void => write({ capture: { ...capture, custom: next } }, WHAT);
  const edit = (index: number, patch: (row: CaptureDelimiter) => CaptureDelimiter): void => put(custom.map((row, i) => (i === index ? patch(row) : row)));
  const tooLong = (t: string): string | null => (t.length > CAPTURE_MAX_LENGTH ? `Use at most ${String(CAPTURE_MAX_LENGTH)} characters.` : null);
  return (
    <>
      {custom.map(/* bounded-ok: capped at CAPTURE_MAX_CUSTOM rows */ (row, i) => (
        <div key={i} data-part="scene.messenger.settings.writing.tag">
          <CheckedText label={`Own tag ${String(i + 1)} opens with`} description="Any text works, not just tags, for example Status: or ---." saved={row.open} rows={1} check={tooLong}
            write={(open) => edit(i, (r) => ({ open, close: !r.close || r.close === closingForOpening(r.open) ? closingForOpening(open) || r.close : r.close }))} />
          <CheckedText label={`Own tag ${String(i + 1)} closes with`} saved={row.close} rows={1} check={tooLong} write={(close) => edit(i, (r) => ({ ...r, close }))} />
          <ActionRow label={`Remove own tag ${String(i + 1)}`} action="Remove" variant="danger" onAction={() => put(custom.filter((_, at) => at !== i))} />
        </div>
      ))}
      {custom.length < CAPTURE_MAX_CUSTOM && <ActionRow label="Your own tags" description="Catch text of your own, not only the built-in tags." action="Add your own tag" onAction={() => put([...custom, { open: "", close: "" }])} />}
    </>
  );
}
