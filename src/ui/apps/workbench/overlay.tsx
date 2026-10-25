/** Workbench overlay: open editors, unsaved markers and the existing split-pane action. */
import type { OverlayWidgetProps } from "../../app-contract";
import { OverlayWidget } from "../../components/overlay-widget";
import { keyOf, paneKeyOf } from "../../_shared/piece-key";
import { deckMeta } from "../../_shared/decks";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const pieces = ctx.workbench.pieces(); const dirty = ctx.workbench.dirty(); const beside = ctx.workbench.beside(); const active = ctx.workbench.active();
  return <><OverlayWidget title="Open on your bench"><ul>{pieces.map((p) => <li key={paneKeyOf(p)}><button onClick={() => { ctx.workbench.focus(p.id, p.kind, p.params?.focusEntry); onActivate(); }}><span>{p.name}<small>{deckMeta(p.kind).singular}{p.params?.focusEntry ? " / Entry editor" : ""}{active && paneKeyOf(active) === paneKeyOf(p) ? " / Active pane" : beside && paneKeyOf(beside) === paneKeyOf(p) ? " / Beside" : ""}</small></span><small>{dirty[keyOf(p.id, p.kind)] ? "Unsaved" : "Saved"}</small></button></li>)}</ul>
    {!pieces.length && <p>No editors are open. Choose a piece in the Library.</p>}</OverlayWidget>
    <OverlayWidget title="Editor arrangement"><dl><dt>Active editor</dt><dd>{active?.name ?? "None"}</dd><dt>Beside it</dt><dd>{beside?.name ?? "Single pane"}</dd></dl>
      {beside && <button onClick={() => { ctx.workbench.closeSplit(); onActivate(); }}>Return to a single pane</button>}</OverlayWidget></>;
}
