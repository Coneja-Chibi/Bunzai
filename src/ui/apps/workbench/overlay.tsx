/** Workbench overlay: open editors, unsaved markers and the existing split-pane action. */
import { Button, ListRow } from "../../components/button";
import type { OverlayWidgetProps } from "../../app-contract";
import { OverlayWidget } from "../../components/overlay-widget";
import { keyOf, paneKeyOf } from "../../_shared/piece-key";
import { deckMeta } from "../../_shared/decks";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const pieces = ctx.workbench.pieces(); const dirty = ctx.workbench.dirty(); const beside = ctx.workbench.beside(); const active = ctx.workbench.active();
  return <><OverlayWidget title="Open on your bench"><ul>{pieces.map(/* bounded-ok: tabs, ports, options, chips and per-item detail inside one document */ (p) => <li key={paneKeyOf(p)}><ListRow onClick={() => { ctx.workbench.focus(p.id, p.kind, p.params?.focusEntry); onActivate(); }}
    label={p.name}
    subtitle={`${deckMeta(p.kind).singular}${p.params?.focusEntry ? " / Entry editor" : ""}${active && paneKeyOf(active) === paneKeyOf(p) ? " / Active pane" : beside && paneKeyOf(beside) === paneKeyOf(p) ? " / Beside" : ""}`}
    meta={dirty[keyOf(p.id, p.kind)] ? "Unsaved" : "Saved"} /></li>)}</ul>
    {!pieces.length && <p>No editors are open. Choose a piece in the Library.</p>}</OverlayWidget>
    <OverlayWidget title="Editor arrangement"><dl><dt>Active editor</dt><dd>{active?.name ?? "None"}</dd><dt>Beside it</dt><dd>{beside?.name ?? "Single pane"}</dd></dl>
      {beside && <Button size="sm" onClick={() => { ctx.workbench.closeSplit(); onActivate(); }}>Return to a single pane</Button>}</OverlayWidget></>;
}
