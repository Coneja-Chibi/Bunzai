/** HTML View overlay: a document tray that hands saved pages to the existing sealed viewer. */
import { Button } from "../../components/button";
import type { OverlayWidgetProps } from "../../app-contract";
import { usePieceList } from "../../agent/use-studio-changes";
import { handOffPiece } from "../../agent/html-handoff";
import { OverlayWidget } from "../../components/overlay-widget";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const pieces = usePieceList(ctx.pieces); const pages = pieces.filter((p) => p.kind === "htmldoc");
  if (!ctx.pieces.isSeeded()) return <OverlayWidget title="Saved page tray"><p>{ctx.workbench.restoreFailure?.() ?? "Loading saved pages..."}</p></OverlayWidget>;
  return <OverlayWidget title="Saved page tray"><div className="overlay-widget-page"><strong>HTML View</strong><p>Saved pages open in the existing sealed preview.</p></div>
    <ul>{pages.slice(0, 5).map((p) => <li key={p.id}><Button onClick={() => { handOffPiece(p.id); onActivate(); }}>{p.name}<small>View page</small></Button></li>)}</ul>
    {!pages.length && <p>No saved HTML pages in your library.</p>}<Button onClick={onActivate}>Return to the preview</Button></OverlayWidget>;
}
