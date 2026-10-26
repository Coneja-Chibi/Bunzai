/**
 * Lore & state's Macros view (RoleCall `DebugWingPanelV2.tsx` MacrosTab): the Macros / Tokens Added / Errors tiles, "Search macros...", and a row per macro that ran, the hotspots first:
 * the macro as first written, how many times it ran (`x3`), the tokens it put in the request (`+N tok`), and a fold with what it produced and a copy button. Failures are listed above the
 * rows. It reads the macro pass the assembly stored with the reply, so a reply from before that record says so. RoleCall's per-source chips and character ranges are left out: the pass
 * does not know which block a macro sat in.
 */
import { useState, type JSX } from "react";
import { Ic } from "../../../_shared/ic";
import { IconButton } from "../../../components/button";
import { copyText } from "../../../_shared/clipboard";
import { FLASH_MS, useFlash } from "../../../_shared/use-flash";
import type { MacroReport } from "../../../../core/assembly/types";
import type { SceneTrace } from "../../../app-contract-scenes";
import { macroRows, macroTiles } from "./macros-core";

/** The failed macros, each as written with the engine's message (shared with State's Macro Errors tile). */
export function MacroErrors({ errors }: { errors: MacroReport["errors"] }): JSX.Element | null {
  if (errors.length === 0) return null;
  return (
    <div className="ls-merrs">
      {errors.map((e, i) => <p className="ls-merr" key={i}><Ic name="lucide:circle-alert" size={12} /><code>{e.macro}</code><span>{e.message}</span></p>)}
    </div>
  );
}

export function Macros({ trace }: { trace: SceneTrace }): JSX.Element {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const copied = useFlash<string>(FLASH_MS.copy);
  const report = trace.macros;
  if (!report) return <div className="ls-pane"><div className="ls-none"><Ic name="lucide:info" size={24} /><p>This reply was written before its macros were kept.</p></div></div>;
  const tiles = macroTiles(report);
  const rows = macroRows(report, query);
  return (
    <div className="ls-pane">
      <div className="ls-sum">
        <div><b>{tiles.macros}</b><small>Macros</small></div>
        <div><b>{tiles.tokens}</b><small>Tokens Added</small></div>
        <div><b>{tiles.errors}</b><small>Errors</small></div>
      </div>
      <div className="ls-search"><Ic name="lucide:search" size={14} /><input type="search" placeholder="Search macros..." aria-label="Search macros" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <div className="ls-list">
        <MacroErrors errors={report.errors} />
        {rows.length === 0 && <div className="ls-none"><Ic name="lucide:info" size={24} /><p>{query.trim() ? "No macros match the search" : "No macros ran in this request"}</p></div>}
        {rows.map((u) => (
          <div key={u.name}>
            <div className="ls-node ls-macro" role="button" tabIndex={0} aria-expanded={open === u.name} onClick={() => setOpen(open === u.name ? null : u.name)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(open === u.name ? null : u.name); } }}>
              <Ic name={open === u.name ? "lucide:chevron-down" : "lucide:chevron-right"} size={12} />
              <span className="ls-name"><code>{u.example}</code><small>{u.value.length > 60 ? `${u.value.slice(0, 60)}...` : u.value}</small></span>
              {u.count > 1 && <span className="ls-loop">x{u.count}</span>}
              <span className="ls-num">+{u.tokens} tok</span>
            </div>
            {open === u.name && (
              <div className="ls-body">
                <span className="ls-copy"><IconButton variant="quiet" size="sm" label="Copy value" icon={copied.value === u.name ? "lucide:check" : "lucide:copy"} onClick={() => { void copyText(u.value).then((ok) => { if (ok) copied.flash(u.name); }); }} /></span>
                <pre>{u.value}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="ls-foot"><span>{report.used.length} macros</span><span>{tiles.tokens} tokens added</span></div>
    </div>
  );
}
