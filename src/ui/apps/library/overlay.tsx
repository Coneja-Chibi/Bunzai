/** Library overlay: live deck counts and recent arrivals from the canonical summary store. */
import type { OverlayWidgetProps } from "../../app-contract";
import { usePieceList } from "../../agent/use-studio-changes";
import { deckMeta } from "../../_shared/decks";
import { OverlayWidget } from "../../components/overlay-widget";
import { ListRow } from "../../components/button";
import { deckCounts } from "./deck-core";
import styles from "./overlay.module.css";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const pieces = usePieceList(ctx.pieces);
  if (!ctx.pieces.isSeeded()) return <OverlayWidget title="Your library decks"><p>{ctx.workbench.restoreFailure?.() ?? "Loading the library inventory..."}</p></OverlayWidget>;
  const counts = deckCounts([...pieces], []);
  return <><OverlayWidget title="Your library decks"><div className={`overlay-widget-grid ${styles.counts}`}>
    {counts.map(({ kind, count }) => <div className="overlay-widget-tile" key={kind}><strong>{count}</strong>{deckMeta(kind).plural}</div>)}
    {!pieces.length && <p>Your library has no pieces yet. Import files to begin.</p>}
  </div></OverlayWidget><OverlayWidget title="Recent arrivals"><ul>
    {[...pieces].sort((a, b) => (b.importedAt ?? "").localeCompare(a.importedAt ?? "")).slice(0, 3).map((p) => <li key={`${p.kind}:${p.id}`}><ListRow onClick={() => { ctx.workbench.open(p); onActivate(); }} label={p.name} subtitle={deckMeta(p.kind).singular} meta={<span aria-hidden="true">Open</span>} /></li>)}
  </ul>{!pieces.length && <p>Imported pieces will appear here.</p>}</OverlayWidget></>;
}
