/**
 * Moving a scene to the latest card (ChatStore rule 13; approved wireframe rc-port/scene-latest-card.html):
 * RoleCall's Library "Update available" badge, shown in the scene header and on the Cast wing's card,
 * the notice line over that card, and the confirm, shaped like RoleCall's fork dialog. Updating keeps
 * the old copy, so the Cast wing offers the way back.
 */
import type { JSX } from "react";
import { InkDialog } from "../../components/ink-dialog";
import { Button, Chip } from "../../components/button";
import { Ic } from "../../_shared/ic";

/** Where the scene's card stands against the library's. */
export interface CardState {
  name: string;
  version: number;
  /** The library's version now, or null when the card is gone from it. */
  latest: number | null;
  /** The version the last update replaced, while it can be put back. */
  previous: number | null;
}

export const isNewer = (c: CardState): boolean => c.latest !== null && c.latest > c.version;

export function UpdateBadge({ onClick }: { onClick(): void }): JSX.Element {
  return <span className="upd"><Chip tone="var(--stage-warn)" data-part="scene.update-badge" title="Click to accept update" onClick={onClick}><Ic name="lucide:refresh-cw" size={10} />Update available</Chip></span>;
}

export function CardNotice({ card, onRevert }: { card: CardState; onRevert(): void }): JSX.Element | null {
  if (card.latest === null) return <p className="notice gone">{card.name}&apos;s card is in the Trash. This scene keeps playing its own copy, version {card.version}.</p>;
  if (isNewer(card)) return <p className="notice">This scene plays version {card.version} of {card.name}. The Library has version {card.latest}.</p>;
  if (card.previous === null) return null;
  return (
    <p className="notice row">
      <span className="grow">This scene plays version {card.version}. Messages already in the scene stay as they were.</span>
      <Button variant="quiet" size="sm" onClick={onRevert}>Back to version {card.previous}</Button>
    </p>
  );
}

export function UpdateCardDialog({ card, onCancel, onUpdate }: { card: CardState; onCancel(): void; onUpdate(): void }): JSX.Element {
  return (
    <InkDialog onDismiss={onCancel} ariaLabel="Update to the latest card">
      <div className="scn-sheet gilt">
        <header className="hd"><div className="eb"><Ic name="lucide:refresh-cw" size={16} />Scene cast</div><h2>Update to the latest card</h2><p>{card.name}, version {card.version} to version {card.latest}.</p></header>
        <div className="bd">
          <div className="box"><div className="t">This update changes</div><ul><li>Name, art, description, and prompts, from version {card.latest}</li><li>Only this scene; other scenes keep their own version</li></ul></div>
          <div className="box"><div className="t">It keeps</div><ul><li>Every message already in the scene, exactly as written</li><li>Version {card.version}, so you can go back from the Cast wing</li></ul></div>
        </div>
        <footer className="ft"><Button autoFocus onClick={onCancel}>Keep version {card.version}</Button><Button variant="primary" tone="var(--stage-warn)" onClick={onUpdate}>Update</Button></footer>
      </div>
    </InkDialog>
  );
}
