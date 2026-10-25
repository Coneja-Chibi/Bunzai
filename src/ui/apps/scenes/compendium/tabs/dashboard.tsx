/**
 * The Dashboard tab (RoleCall `BentoDashboard.tsx:601-764,1457-2044`): the header (crumb, name, updated, tree stats), then the
 * World Concepts rail, the Of Note strip and the masonry of cells. Read-only: no rename pencil, no Tree
 * maintenance (Track D). `banner` is where the Standardize banner and its run cards draw; `headerActions` is where Export and Reconcile (Track C) draw their buttons; `recentWrites`
 * is what the receipts say was written. "Updated" shows only a time a receipt gave, never one inferred from book order (F15).
 */
import type { JSX, ReactNode } from "react";
import type { BookModel } from "../compendium-core";
import { GLYPH } from "../compendium-core";
import { CrossRefCell } from "../cells/cell-graph";
import { Creature, FeaturedCast, Spotlight, TreeCell } from "../cells/cells-featured";
import { EntryCounts, OfNote, PlotsInMotion, Recaps, RecentWrites, ThreatRadar, WorldConcepts, type RecentWrite } from "../cells/cells-lists";

export function Dashboard({ model, bookName, onOpen, onTree, headerActions, banner, recentWrites = [], maintenance }: {
  model: BookModel; bookName: string; onOpen(id: string): void; onTree(): void; headerActions?: ReactNode; banner?: ReactNode; recentWrites?: readonly RecentWrite[]; maintenance?: ReactNode;
}): JSX.Element {
  const d = model.dashboard;
  return (
    <div className="cp-dash" data-part="compendium.dashboard">
      <div className="cp-dh">
        <div className="lh">
          <div className="crumb2"><span>Lorebook</span><span>{GLYPH.sep}</span><span className="cur">{bookName}</span><span>{GLYPH.sep}</span><span>Dashboard</span></div>
          <h1>{bookName}</h1>
        </div>
        <div className="rh">
          <div>{recentWrites[0] ? `Updated ${recentWrites[0].at}` : "Updated -"}</div>
          <div>TV Tree {GLYPH.dot} {d.tree.nodeCount} nodes {GLYPH.dot} depth {d.tree.maxDepth}</div>
          <div className="acts" data-mount="compendium.headerActions">{headerActions}</div>
          {maintenance}
        </div>
      </div>
      <div data-mount="compendium.standardize">{banner}</div>
      <WorldConcepts d={d} onOpen={onOpen} />
      <OfNote d={d} onOpen={onOpen} />
      <div className="cp-masonry">
        <FeaturedCast m={model} onOpen={onOpen} />
        <EntryCounts d={d} />
        <RecentWrites writes={recentWrites} onOpen={onOpen} />
        <PlotsInMotion d={d} onOpen={onOpen} />
        <ThreatRadar d={d} onOpen={onOpen} />
        <TreeCell m={model} onOpen={onOpen} onTree={onTree} />
        <Recaps d={d} onOpen={onOpen} />
        <CrossRefCell m={model} onOpen={onOpen} />
        <Spotlight m={model} onOpen={onOpen} />
        <Creature m={model} onOpen={onOpen} />
      </div>
    </div>
  );
}
