/**
 * The model button and its dropdown, shared by the Booth's Narrator Model and Fallback Model rows (RoleCall's
 * QuickPlayPanel Narrator Model picker, :1709-1904): a 40px tile with the model's display name and its provider and window, over a dropdown
 * capped at 16rem with the Provider filter, a search, and each connection's models under a sticky head, 32px tile and name first. The list is the AI wing's own
 * (use-scene-models.ts). What a pick does is the caller's: the scene's model, or the fallback. RoleCall's billing badges ("Not In Your Plan", "In-house") have no
 * Bunzai counterpart; a connection scenes cannot use shows "Setup Required" and its reason, and cannot be picked. RoleCall's second filter, Model type, needs a
 * family per model that Kit's lists do not carry, so it is not drawn. RoleCall anchors the dropdown to the bottom of its whole section (under the Fallback control);
 * here it opens under the button it belongs to.
 */
import { useState, type JSX } from "react";
import { Chip, ListRow } from "../../components/button";
import { Ic } from "../../_shared/ic";
import { VirtualRows } from "../../_shared/virtual-list";
import { useEscapeKey } from "../../_shared/use-escape-key";
import type { ChatConnection } from "../../../stage/contracts/chat-store";
import { keyOf, type SceneModels } from "./use-scene-models";

const MODEL_ROW_PX = 56;

/** A stated window as RoleCall writes it: "200K ctx". */
const ctxOf = (n: number | undefined): string => (n ? ` · ${String(Math.round(n / 1000))}K ctx` : "");

export function BoothModelPicker({ current, models, onPick }: { current: ChatConnection | undefined; models: SceneModels; onPick(c: ChatConnection): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("all");
  const [query, setQuery] = useState("");
  useEscapeKey(() => setOpen(false), open);
  const { conns, models: byConn, labelOf, windowOf, nameOf } = models;
  const q = query.trim().toLowerCase();
  const countOf = (id: string): number => { const m = byConn[id]; return m?.state === "ready" ? m.ids.length : 0; };
  const shown = (conns ?? []).filter((c) => provider === "all" || c.id === provider);
  const groups = shown.map((c) => {
    const m = byConn[c.id];
    const ids: { id: string; label?: string; context?: number }[] = c.unavailable ? [{ id: c.model }] : m?.state === "ready" ? m.ids : m?.state === "failed" ? [{ id: m.saved }] : [];
    return { c, loading: !c.unavailable && (!m || m.state === "loading"), ids: ids.filter((x) => !q || `${x.id} ${x.label ?? ""}`.toLowerCase().includes(q)) };
  });
  const sub = !current ? "Select a model" : conns ? `${labelOf(current.id)}${ctxOf(windowOf(current))}` : "Loading model info...";
  return (
    <div className="bth-pickwrap">
      <ListRow variant="picker" aria-expanded={open} onClick={() => setOpen(!open)} leading={<Ic name="lucide:sparkles" size={20} />}
        label={current ? nameOf(current) : "No model selected"} subtitle={sub} />
      {open && (
        <div className="bth-drop" data-part="scene.ai.picker">
          <div className="bth-df">
            <div className="bth-dl">Provider</div>
            <div className="bth-chips" role="group" aria-label="Provider">
              <Chip pressed={provider === "all"} onClick={() => setProvider("all")}>All<i>{(conns ?? []).reduce((n, c) => n + countOf(c.id), 0)}</i></Chip>
              {(conns ?? []).map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (c) => (
                <Chip key={c.id} pressed={provider === c.id} title={c.unavailable} onClick={() => setProvider(c.id)}>{c.label}<i>{countOf(c.id)}</i></Chip>
              ))}
            </div>
          </div>
          <div className="bth-ds"><input value={query} placeholder="Search selected filters..." aria-label="Search models" autoFocus onChange={(e) => setQuery(e.target.value)} /></div>
          <div className="bth-dlist">
            {!conns && <p className="bth-dnote">Loading models...</p>}
            {conns && groups.every((g) => !g.loading && g.ids.length === 0) && <p className="bth-dnote">No models found</p>}
            {groups.map(({ c, loading, ids }) => (ids.length > 0 || loading) && (
              <div key={c.id} className="bth-grp">
                <div className="grp-hd">{c.label}</div>
                {loading && <p className="bth-dnote">Loading models...</p>}
                <VirtualRows items={ids} keyOf={(x) => x.id} estimate={MODEL_ROW_PX} render={(x) => {
                  const conn = { id: c.id, model: x.id };
                  const on = current !== undefined && keyOf(current) === keyOf(conn);
                  return (
                    <ListRow selected={on} disabled={c.unavailable !== undefined} title={c.unavailable}
                      onClick={() => { onPick(conn); setOpen(false); }}
                      leading={<Ic name="lucide:sparkles" size={16} />}
                      label={<>{x.label ?? x.id}{c.unavailable && <i className="bth-badge">Setup Required</i>}</>}
                      subtitle={c.unavailable ?? `${c.label}${ctxOf(x.context)}`}
                      trailing={!c.unavailable && on ? <span className="bth-ck"><Ic name="lucide:check" size={16} /></span> : undefined} />
                  );
                }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
