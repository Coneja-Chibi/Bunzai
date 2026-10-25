/**
 * The AI wing's Model tab as one flat list of rows (RoleCall `ModelSelector.tsx:604-855`): Currently Selected,
 * Favorites, then each connection's models under its name. Flat so the list can be windowed: a provider with
 * hundreds of models draws only the rows on screen. Search and the provider filter only narrow the lists
 * already read; they never ask a provider again.
 */
import type { SceneConnectionInfo } from "../../app-contract-scenes";
import type { ChatConnection } from "../../../stage/contracts/chat-store";
import { keyOf, type Models } from "./use-scene-models";

export type ModelRow =
  | { kind: "hd"; key: string; label: string; variant: "sel" | "fav" | "grp" }
  | { kind: "model"; key: string; conn: ChatConnection; name: string; sub: string; window?: number; current: boolean; on: boolean; favorite: boolean }
  | { kind: "na"; key: string; name: string; sub: string; why: string }
  | { kind: "note"; key: string; text: string; retry?: string }
  | { kind: "load"; key: string; text: string };

export interface RowInput {
  conns: readonly SceneConnectionInfo[];
  models: Readonly<Record<string, Models>>;
  favorites: readonly string[];
  current: ChatConnection | undefined;
  query: string;
  /** A connection id, or "all". */
  filter: string;
}

export function modelRows({ conns, models, favorites, current, query, filter }: RowInput): ModelRow[] {
  const q = query.trim().toLowerCase();
  const label = (id: string) => conns.find((c) => c.id === id)?.label ?? "a connection Kit no longer has";
  const found = (id: string, name: string) => !q || `${id} ${name}`.toLowerCase().includes(q);
  const shown = conns.filter((c) => filter === "all" || c.id === filter);
  const here = (c: ChatConnection) => current !== undefined && keyOf(current) === keyOf(c);
  const rows: ModelRow[] = [];
  const model = (conn: ChatConnection, name: string, sub: string, window?: number): Extract<ModelRow, { kind: "model" }> =>
    ({ kind: "model", key: keyOf(conn), conn, name, sub, ...(window ? { window } : {}), current: false, on: here(conn), favorite: favorites.includes(keyOf(conn)) });

  if (current) {
    const listed = models[current.id];
    const info = listed?.state === "ready" ? listed.ids.find((x) => x.id === current.model) : undefined;
    rows.push({ kind: "hd", key: "hd-sel", label: "Currently Selected", variant: "sel" });
    rows.push({ ...model(current, info?.label ?? current.model, label(current.id), info?.context), key: `sel-${keyOf(current)}`, current: true });
  }
  const favs = favorites.flatMap((k): ModelRow[] => {
    const [id = "", ...rest] = k.split("|");
    const conn = { id, model: rest.join("|") };
    const c = conns.find((x) => x.id === id);
    if (!c || c.unavailable || (filter !== "all" && id !== filter)) return [];
    const m = models[id];
    const info = m?.state === "ready" ? m.ids.find((x) => x.id === conn.model) : undefined;
    return found(conn.model, info?.label ?? "") ? [{ ...model(conn, info?.label ?? conn.model, `Model from ${c.label}`, info?.context), key: `fav-${k}` }] : [];
  });
  if (favs.length > 0) rows.push({ kind: "hd", key: "hd-fav", label: "Favorites", variant: "fav" }, ...favs);

  for (const c of shown) {
    const head: ModelRow = { kind: "hd", key: `hd-${c.id}`, label: c.label, variant: "grp" };
    if (c.unavailable) {
      if (!q) rows.push(head, { kind: "na", key: `na-${c.id}`, name: c.model, sub: c.label, why: c.unavailable });
      continue;
    }
    const m = models[c.id] ?? { state: "loading" };
    if (m.state === "loading") rows.push(head, { kind: "load", key: `load-${c.id}`, text: `Asking ${c.label} for its models...` });
    else if (m.state === "failed") {
      rows.push(head, { kind: "note", key: `note-${c.id}`, text: `Couldn't list ${c.label}'s models (${m.why}). The model saved on this connection is still here.`, retry: c.id });
      if (found(m.saved, "")) rows.push({ ...model({ id: c.id, model: m.saved }, m.saved, `${c.label} · saved on the connection`), key: `saved-${c.id}` });
    } else {
      const listed = m.ids.filter((x) => found(x.id, x.label ?? ""));
      if (listed.length > 0 || !q) rows.push(head);
      for (const x of listed) rows.push(model({ id: c.id, model: x.id }, x.label ?? x.id, `Model from ${c.label}`, x.context));
    }
  }
  return rows;
}
