/**
 * The Cross-Reference Graph explorer (RoleCall `GraphExploreModal.tsx`, a fullscreen modal that does not float, so it is a dialog and
 * not a pop-out kind): a header with BACK and CLOSE, filters on the left, the graph with zoom buttons and a detail panel, and a status
 * bar. Pan, wheel zoom, select a node (it only selects), drag a node to move it (use-node-drag.ts), hover to light its neighbours, and
 * OPEN IN CODEX to open its entry page. The book is laid out once per revision (graph-core.ts); the filters, search, selection, camera
 * and a dragged node only hide, dim and move.
 */
import { useMemo, useRef, useState, type JSX } from "react";
import { InkDialog } from "../../../../components/ink-dialog";
import { Button, IconButton } from "../../../../components/button";
import type { BookModel } from "../compendium-core";
import { GLYPH } from "../compendium-core";
import { GraphLayer } from "./graph-canvas";
import {
  allFilters, connectionsOf, neighbours, nodeSize, resolvedLinks, searchHits, sharedLayoutOf, visibleOf, ZOOM_MAX, type GraphLayout,
} from "./graph-core";
import { GraphDetail, GraphSide } from "./graph-side";
import { useGraphView } from "./use-graph-view";
import { useNodeDrag } from "./use-node-drag";

export interface GraphExploreProps {
  m: BookModel;
  /** Open an entry's page (the modal closes first). */
  onOpen(entryId: string): void;
  onClose(): void;
  /** The layout source; tests count its calls. */
  layoutOf?: (g: BookModel["graph"]) => GraphLayout;
}

export function GraphExploreModal({ m, onOpen, onClose, layoutOf = sharedLayoutOf }: GraphExploreProps): JSX.Element {
  const [f, setF] = useState(allFilters);
  const [edgeLabels, setEdgeLabels] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const graph = m.graph;
  const links = useMemo(() => resolvedLinks(graph), [graph]);
  const layout = useMemo(() => layoutOf(graph), [graph, layoutOf]);
  const vis = useMemo(() => visibleOf(graph, links, f), [graph, links, f]);
  const hits = useMemo(() => searchHits(vis.nodes, query), [vis.nodes, query]);
  const counts = useMemo(() => graph.nodes.reduce<Record<string, number>>((c, n) => ({ ...c, [n.type]: (c[n.type] ?? 0) + 1 }), {}), [graph]);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const node = selected ? vis.nodes.find((n) => n.id === selected) ?? null : null;
  const focus = hover ?? node?.id ?? null;
  const lit = useMemo(() => (focus ? neighbours(vis.links, focus) : null), [vis.links, focus]);
  const zoom = useRef(1);
  const { moved, drag } = useNodeDrag(graph, (id) => layout.at.get(id), () => zoom.current);
  const cam = useGraphView(() => vis.nodes.map((n) => ({ ...(moved.get(n.id) ?? layout.at.get(n.id)!), r: nodeSize(n.refs) / 2 })), () => setSelected(null));
  zoom.current = cam.view.k;
  const detail = useMemo(() => (node ? { connections: connectionsOf(links, node.id).map((c) => ({ other: byId.get(c.other)!, edge: c.edge })), total: links.filter((l) => l.from === node.id || l.to === node.id).length } : null), [node, links, byId]);
  const open = (id: string): void => { onClose(); onOpen(id); };

  return (
    <InkDialog ariaLabel="Cross-Reference Graph" onDismiss={onClose} sheetClassName="cp-gx">
      <header className="gx-hd" data-part="compendium.graph">
        <div className="l">
          <Button variant="quiet" size="sm" onClick={onClose}>{"←"} Back</Button>
          <div>
            <small>Lorebook{m.name ? ` ${GLYPH.dot} ${m.name}` : ""}</small>
            <h3>Cross-Reference Graph<i>lorebook connections explorer</i></h3>
          </div>
        </div>
        <Button variant="quiet" size="sm" onClick={onClose}>CLOSE {"✕"}</Button>
      </header>
      <div className="gx-body">
        <GraphSide f={f} onF={setF} counts={counts} query={query} onQuery={setQuery} hits={hits.size} edgeLabels={edgeLabels} onEdgeLabels={setEdgeLabels} />
        <div className="gx-stage" ref={cam.stage}>
          <svg className="gx-svg" role="group" aria-label="Cross-reference graph" {...cam.pan}>
            <g className="vp" transform={`translate(${cam.view.x} ${cam.view.y}) scale(${cam.view.k})`}>
              <GraphLayer nodes={vis.nodes} links={vis.links} layout={layout} moved={moved} drag={drag} selected={node?.id ?? null} lit={lit} hits={hits} labels={cam.view.k >= 1} edgeLabels={edgeLabels} onPick={setSelected} onHover={setHover} />
            </g>
          </svg>
          {vis.nodes.length === 0 && <p className="gx-none">No nodes match the current filters.</p>}
          {node && detail && <GraphDetail node={node} connections={detail.connections} total={detail.total} onPick={setSelected} onOpen={() => open(node.id)} />}
          <div className="gx-zoom">
            <IconButton size="sm" label="Zoom in" icon="lucide:plus" disabled={cam.view.k >= ZOOM_MAX} onClick={cam.zoomIn} />
            <IconButton size="sm" label="Zoom out" icon="lucide:minus" onClick={cam.zoomOut} />
            <Button size="sm" title="Fit to screen" aria-label="Fit to screen" onClick={cam.fit}>FIT</Button>
          </div>
        </div>
      </div>
      <footer className="gx-status">
        <span>LOREBOOK <b>{graph.nodes.length}</b> ENTRIES</span>
        <span>GRAPH <b>{graph.nodes.length}</b> NODES {GLYPH.dot} <b>{links.length}</b> EDGES</span>
        <span>VISIBLE <b className="hot">{vis.nodes.length}</b> NODES {GLYPH.dot} <b className="hot">{vis.links.length}</b> EDGES</span>
        {node && detail && <span>SELECTED <b className="hot">{node.name}</b> - <b>{detail.total}</b> TOTAL</span>}
        <span className="grow" />
        <span>ZOOM <b>{Math.round(cam.view.k * 100)}%</b></span>
        <span className="how">SCROLL TO ZOOM {GLYPH.dot} DRAG TO PAN {GLYPH.dot} CLICK NODE TO INSPECT</span>
      </footer>
    </InkDialog>
  );
}
