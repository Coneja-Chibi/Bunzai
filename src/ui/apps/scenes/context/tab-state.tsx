/**
 * Lore & state's State view (RoleCall `StateInspectorTab.tsx`): the take's macro variables and the library's globals, read straight from the stores (`ctx.api.getSceneVariables`):
 * a Variables tile, scope chips with counts (session, character, arc, scene, global; internal hidden until asked for), "Search variables...", a refresh button, and rows with the
 * scope, the key and a one-line value that open to the value in full, its update time and, when the stored key differs, "stored as". It works before any reply, and it is read only,
 * as RoleCall's is. After a reply the tiles gain RoleCall's "Mutations Last Render" and "Macro Errors" (from the macro pass the reply stored), and a row's fold gains the variable's own
 * history over the take's replies (variable-history.tsx; RoleCall keeps only the current value).
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type JSX } from "react";
import { Ic } from "../../../_shared/ic";
import { VirtualRows } from "../../../_shared/virtual-list";
import { Chip, Disclosure, IconButton } from "../../../components/button";
import type { AppContext } from "../../../app-contract";
import type { SceneTrace, SceneVariable } from "../../../app-contract-scenes";
import { MacroErrors } from "./tab-macros";
import { VariableHistory } from "./variable-history";
import { classifyStorageKey, formatInspectorValue, previewInspectorValue, type InspectorScope } from "../../../../core/macros/inspector";

const ORDER: InspectorScope[] = ["session", "character", "arc", "scene", "global", "internal"];
const TONE: Record<InspectorScope, string> = { session: "--stage-ok", character: "--deck-character", arc: "--stage-warn", scene: "--stage-var", global: "--deck-persona", internal: "--stage-mute" };

interface Row { id: string; scope: InspectorScope; display: string; stored: string; ns?: string; value: unknown; updatedAt: number }

const rowsOf = (local: readonly SceneVariable[], global: readonly SceneVariable[]): Row[] => {
  const mine = local.map((v): Row => { const c = classifyStorageKey(v.key); return { id: `${c.scope}:${v.key}`, scope: c.scope, display: c.displayKey, stored: v.key, ...(c.characterNs ? { ns: c.characterNs } : {}), value: v.value, updatedAt: v.updatedAt }; });
  const lib = global.map((v): Row => ({ id: `global:${v.key}`, scope: "global", display: v.key, stored: v.key, value: v.value, updatedAt: v.updatedAt }));
  return [...mine, ...lib].sort((a, b) => ORDER.indexOf(a.scope) - ORDER.indexOf(b.scope) || a.display.localeCompare(b.display));
};

const ROW_ESTIMATE_PX = 40;

type Load = { state: "loading" } | { state: "failed"; why: string } | { state: "ready"; rows: Row[] };

type Panel = "mutations" | "errors" | null;

export function StateTab({ ctx, chatId, version, trace }: { ctx: AppContext; chatId: string; version: unknown; trace?: SceneTrace | null }): JSX.Element {
  const [panel, setPanel] = useState<Panel>(null);
  const report = trace?.macros;
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<ReadonlySet<InspectorScope>>(new Set(["internal"]));
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const read = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    ctx.api.getSceneVariables(chatId).then(
      (v) => { if (live) setLoad({ state: "ready", rows: rowsOf(v.local, v.global) }); },
      (e: unknown) => { if (live) setLoad({ state: "failed", why: e instanceof Error && e.message ? e.message : "Failed to load variables" }); },
    );
    return () => { live = false; };
  }, [ctx, chatId, version, tick]);
  const rows = useMemo(() => (load.state === "ready" ? load.rows : []), [load]);
  const counts = useMemo(() => Object.fromEntries(ORDER.map((s) => [s, rows.filter((r) => r.scope === s).length])) as Record<InspectorScope, number>, [rows]);
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => !hidden.has(r.scope) && (q === "" || r.display.toLowerCase().includes(q) || previewInspectorValue(r.value, 200).toLowerCase().includes(q)));
  const flip = (s: InspectorScope): void => setHidden((h) => { const n = new Set(h); if (n.has(s)) n.delete(s); else n.add(s); return n; });
  return (
    <div className="ls-pane">
      <div className="ls-sum">
        <div><b>{rows.length}</b><small>Variables</small></div>
        {report && <div><Chip aria-label="Show Mutations Last Render" pressed={panel === "mutations"} onClick={() => setPanel(panel === "mutations" ? null : "mutations")}><b>{report.mutations.length}</b><small>Mutations Last Render</small></Chip></div>}
        {report && <div><Chip aria-label="Show Macro Errors" pressed={panel === "errors"} onClick={() => setPanel(panel === "errors" ? null : "errors")}><b>{report.errors.length}</b><small>Macro Errors</small></Chip></div>}
        <div className="ls-chips">
          {ORDER.map((s) => (
            <Chip key={s} color={`var(${TONE[s]})`} pressed={!hidden.has(s)} title={hidden.has(s) ? `Show ${s} variables` : `Hide ${s} variables`} onClick={() => flip(s)}>{s} {counts[s]}</Chip>
          ))}
        </div>
      </div>
      {report && panel === "mutations" && (
        <div className="ls-merrs">
          {report.mutations.length === 0 && <p className="ls-meta">The last request changed no variable.</p>}
          {report.mutations.map(/* bounded-ok: per-turn bounded detail lines */ (m, i) => <p className="ls-mut" key={i}><span className="ls-scope">{m.scope}</span><code>{m.key}</code><span>{m.deleted ? "deleted" : previewInspectorValue(m.value, 80)}</span>{m.cause && <small>{m.cause}</small>}</p>)}
        </div>
      )}
      {report && panel === "errors" && (report.errors.length === 0 ? <div className="ls-merrs"><p className="ls-meta">No macro failed in the last request.</p></div> : <MacroErrors errors={report.errors} />)}
      <div className="ls-search">
        <Ic name="lucide:search" size={14} /><input type="search" placeholder="Search variables..." aria-label="Search variables" value={query} onChange={(e) => setQuery(e.target.value)} />
        <IconButton size="sm" label="Refresh variables" icon={load.state === "loading" ? "lucide:loader-circle" : "lucide:refresh-cw"} disabled={load.state === "loading"} onClick={read} />
      </div>
      <div className="ls-list">
        {load.state === "failed" && <p className="ls-err" role="alert"><Ic name="lucide:triangle-alert" size={14} />{load.why}</p>}
        {load.state === "ready" && shown.length === 0 && <div className="ls-none"><Ic name="lucide:info" size={24} /><p>No variables{q ? " match the search" : " set yet"}</p><small>{"{{state.set::session:key::value}}"} and {"{{setvar}}"} state appears here</small></div>}
        <VirtualRows items={shown} keyOf={(r) => r.id} estimate={ROW_ESTIMATE_PX} render={(r) => (
          <div>
            <Disclosure open={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}
              leading={<span className="ls-scope" style={{ "--c": `var(${TONE[r.scope]})` } as CSSProperties}>{r.scope}</span>}
              label={<code>{r.display}</code>} summary={<span className="ls-val">{previewInspectorValue(r.value)}</span>} />
            {open === r.id && (
              <div className="ls-body">
                <pre>{formatInspectorValue(r.value)}</pre>
                <VariableHistory ctx={ctx} chatId={chatId} scope={r.scope === "global" ? "global" : "local"} storedKey={r.stored} />
                <p className="ls-meta">
                  <span>updated {new Date(r.updatedAt).toLocaleString()}</span>
                  {r.ns && <span>character: {r.ns}</span>}
                  {r.stored !== r.display && <span className="mono">stored as {r.stored}</span>}
                </p>
              </div>
            )}
          </div>
        )} />
      </div>
    </div>
  );
}
