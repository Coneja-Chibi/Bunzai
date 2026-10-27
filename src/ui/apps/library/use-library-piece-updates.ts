/** Reflects accepted summary receipts without re-reading the inventory or unrelated bodies. */
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { PieceSnapshot, PieceStore } from "../../_shared/piece-store";
import { loadLoreMeta, type LoreMeta } from "./lore-shelf-ops";
import { loadRegexMeta, type RegexMeta } from "./regex-shelf-ops";
import { loadPersonaMeta, type PersonaMeta } from "./persona-shelf-ops";

/** The kinds whose shelves keep their own tools and projection (lore, regex and persona shelf ops); one-kind behavior, not a kind list to extend. */
const SHELF_KINDS = new Set(["lorebook", "regex", "persona"]);
type Projection = { lore: Record<string, LoreMeta>; regex: Record<string, RegexMeta>; persona: Record<string, PersonaMeta> };
type Replace<T> = (update: (prior: Record<string, T>) => Record<string, T>) => void;
type Input = {
  ctx: AppContext; pieces: PieceStore; setEntities: (rows: StudioEntitySummary[]) => void;
  setLore: Replace<LoreMeta>; setRegex: Replace<RegexMeta>; setPersona: Replace<PersonaMeta>;
  onReady: () => void;
};

export function useLibraryPieceUpdates(input: Input): void {
  const { pieces } = input;
  const rows = useSyncExternalStore(pieces.subscribeList.bind(pieces), pieces.listSnapshot.bind(pieces), () => []);
  const latest = useRef(input);
  latest.current = input;
  const projected = useRef(new Map<string, PieceSnapshot>());
  const pending = useRef(new Map<string, PieceSnapshot>());
  const mounted = useRef(false);
  const ready = useRef(false);
  const completed = useRef(new Map<string, { snapshot: PieceSnapshot; value: Projection; lifetime: number }>());
  const scheduled = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const active = pending.current, done = completed.current;
    return () => { mounted.current = false; active.clear(); done.clear(); };
  }, []);

  useEffect(() => {
    if (!pieces.isSeeded()) return;
    latest.current.setEntities([...rows]);
    const present = new Set(rows.map((row) => `${row.kind}\0${row.id}`));
    latest.current.setLore((old) => retain(old, rows, "lorebook"));
    latest.current.setRegex((old) => retain(old, rows, "regex"));
    latest.current.setPersona((old) => retain(old, rows, "persona"));
    for (const key of projected.current.keys()) if (!present.has(key)) projected.current.delete(key);
    for (const key of pending.current.keys()) if (!present.has(key)) pending.current.delete(key);

    const snapshots = rows.filter((row) => SHELF_KINDS.has(row.kind)).map((row) => pieces.snapshot(row.kind, row.id)).filter((row): row is PieceSnapshot => !!row);
    const lifetime = pieces.captureLifetime();
    for (const snapshot of snapshots) {
      const row = snapshot.summary;
      const key = `${row.kind}\0${row.id}`;
      if (projected.current.get(key) === snapshot || pending.current.get(key) === snapshot) continue;
      pending.current.set(key, snapshot);
      void loadProjection(latest.current.ctx, row).then((value) => {
        if (!mounted.current || !pieces.isCurrentLifetime(lifetime) || pending.current.get(key) !== snapshot || pieces.snapshot(row.kind, row.id) !== snapshot) return;
        pending.current.delete(key);
        projected.current.set(key, snapshot);
        completed.current.set(key, { snapshot, value, lifetime });
        if (!scheduled.current) {
          scheduled.current = true;
          queueMicrotask(() => {
            scheduled.current = false;
            const batch = [...completed.current.values()];
            completed.current.clear();
            if (!mounted.current) return;
            const valid = batch.filter((item) => pieces.isCurrentLifetime(item.lifetime) && pieces.snapshot(item.snapshot.summary.kind, item.snapshot.summary.id) === item.snapshot);
            publish(latest.current, valid);
            if (!ready.current && pieces.isCurrentLifetime(lifetime) && pieces.isSeeded() && pending.current.size === 0 && completed.current.size === 0) { ready.current = true; latest.current.onReady(); }
          });
        }
      }).catch(() => {
        if (pending.current.get(key) === snapshot) pending.current.delete(key);
      });
    }
    if (!ready.current && pieces.isCurrentLifetime(lifetime) && pieces.isSeeded() && pending.current.size === 0 && completed.current.size === 0) { ready.current = true; latest.current.onReady(); }
  }, [pieces, rows]);
}

async function loadProjection(ctx: AppContext, row: StudioEntitySummary): Promise<Projection> {
  const rows = [row];
  const [lore, regex, persona] = await Promise.all([
    loadLoreMeta(ctx, rows), loadRegexMeta(ctx, rows), loadPersonaMeta(ctx, rows),
  ]);
  return { lore, regex, persona };
}

function publish(input: Input, batch: readonly { snapshot: PieceSnapshot; value: Projection }[]): void {
  const replace = <T,>(kind: string, set: Replace<T>, pick: (value: Projection) => Record<string, T>): void => {
    const rows = batch.filter((item) => item.snapshot.summary.kind === kind);
    if (!rows.length) return;
    set((old) => {
      const next = { ...old };
      for (const item of rows) {
        const id = item.snapshot.summary.id, values = pick(item.value);
        delete next[id];
        if (Object.prototype.hasOwnProperty.call(values, id)) next[id] = values[id]!;
      }
      return next;
    });
  };
  replace("lorebook", input.setLore, (value) => value.lore);
  replace("regex", input.setRegex, (value) => value.regex);
  replace("persona", input.setPersona, (value) => value.persona);
}
function retain<T>(old: Record<string, T>, rows: readonly StudioEntitySummary[], kind: string): Record<string, T> {
  const ids = new Set(rows.filter((row) => row.kind === kind).map((row) => row.id));
  const kept = Object.entries(old).filter(([id]) => ids.has(id));
  return kept.length === Object.keys(old).length ? old : Object.fromEntries(kept);
}
