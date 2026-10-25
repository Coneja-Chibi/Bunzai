/** Press overlay: the actual staged export queue, without creating a second export path. */
import type { OverlayWidgetProps } from "../../app-contract";
import { OverlayWidget } from "../../components/overlay-widget";
import { deckMeta } from "../../_shared/decks";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const queue = ctx.press.queue();
  return <OverlayWidget title="On the press"><div className="overlay-widget-tile"><strong>{queue.length}</strong>Staged pieces</div>
    <ol>{queue.slice(0, 6).map((p, at) => <li key={`${p.kind}:${p.id}`}><span>{at + 1}. {p.name}</span><small>{deckMeta(p.kind).singular}</small></li>)}</ol>
    {!queue.length && <p>Stage pieces from the Library before preparing an export.</p>}
    <button onClick={onActivate}>Return to export setup</button><small>Choose formats and review export reports in the Press.</small></OverlayWidget>;
}
