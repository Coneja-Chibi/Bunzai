/**
 * The Dashboard header's "Tree maintenance" disclosure (RoleCall `BentoDashboard.tsx` header): `Repair tree from entries`, which asks
 * the Compendium's model to sort the book's entries into a tree the Browse TV Tree then shows, and `Repairing...` while it runs. It
 * adds what RoleCall has no equivalent of: Undo last build, which shows the layout before it or the tree derived from the book, and
 * the notes a build had to repair. Building edits the book only with Refine entries during build on (Settings). The words differ from RoleCall's, which says Standardization builds
 * the tree; here a typed book's tree is derived and this is the optional model-built one.
 */
import type { JSX } from "react";
import type { CompendiumTreeStore } from "../use-compendium-tree";
import { Button } from "../../../../components/button";

export function TreeMaintenance({ store }: { store: CompendiumTreeStore }): JSX.Element {
  const building = store.busy === "build";
  return (
    <details className="cp-maint" data-part="compendium.maintenance">
      <summary>Tree maintenance</summary>
      <p>Sorts the book&apos;s entries into a tree with the Compendium model. Your Lock, Forbid, Reorganize and Move choices are kept. Undo last build shows the tree as it was. The book is not changed unless Refine entries during build is on in Settings; its splits and merges are undone from Activity.</p>
      <div className="row">
        <Button variant="primary" size="sm" disabled={store.busy !== null} onClick={() => void store.build()}>{building ? "Repairing..." : "Repair tree from entries"}</Button>
        {store.layout && <Button size="sm" disabled={store.busy !== null} onClick={() => void store.undo()}>{store.busy === "undo" ? "Undoing..." : "Undo last build"}</Button>}
      </div>
      {store.notes.length > 0 && <ul className="notes" aria-label="What the build repaired">{store.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </details>
  );
}
