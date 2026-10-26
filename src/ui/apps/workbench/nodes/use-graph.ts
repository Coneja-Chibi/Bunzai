/**
 * The Nodes view's live graph: reads the stored references of every open piece that has link ports,
 * re-reads when the library reports a new revision (or after a write here), and derives nodes and
 * wires from them.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { keyOf } from "../../../_shared/piece-key";
import { deriveGraph, portsOf } from "./links";
import { readSource } from "./link-write";

export function useGraph(ctx: AppContext, open: readonly StudioEntitySummary[]) {
  useSyncExternalStore(ctx.pieces.subscribeList.bind(ctx.pieces), ctx.pieces.listSnapshot.bind(ctx.pieces), () => []);
  const [bodies, setBodies] = useState<Record<string, unknown>>({});
  const [bump, setBump] = useState(0);
  const sources = open.filter((p) => portsOf(p.kind).length > 0);
  const stamp = sources.map((p) => `${keyOf(p.id, p.kind)}@${ctx.pieces.snapshot(p.kind, p.id)?.revision ?? p.revision ?? ""}`).join("|");
  useEffect(() => {
    let live = true;
    for (const p of sources) {
      void readSource(ctx, p.kind, p.id).then(
        (r) => { if (live) setBodies((prev) => ({ ...prev, [keyOf(p.id, p.kind)]: r.entity.body })); },
        () => { if (live) ctx.setStatus(`could not read the links of ${p.name}`); },
      );
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, bump]);
  const graph = useMemo(
    () => deriveGraph(open, bodies, (kind, id) => ctx.pieces.snapshot(kind, id)?.summary),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, bodies, stamp],
  );
  return { graph, bodies, reload: () => setBump((n) => n + 1) };
}
