/**
 * Lore & state's three views of the one request (RoleCall `DebugWingPanelV2.tsx`): Sources (the request grouped by what each block is, a share and a bar each, and a button
 * that points Compose at it), Flow ("Token Distribution by Source") and Compose (the request in send order, a block opens to its text with a copy button). All three read
 * lore-state-core.ts, which reads the assembler's own block counts. RoleCall's "via macro" chips and macro contributions are left out: the trace keeps no macro expansions.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { Ic } from "../../../_shared/ic";
import { Chip, IconButton } from "../../../components/button";
import { copyText } from "../../../_shared/clipboard";
import { FLASH_MS, useFlash } from "../../../_shared/use-flash";
import type { SceneTrace } from "../../../app-contract-scenes";
import { composeRows, flowBars, isHighlighted, sourceTree, totalTokens, type Highlight } from "./lore-state-core";

const tone = (colorVar: string): CSSProperties => ({ "--c": `var(${colorVar})` } as CSSProperties);

export function Sources({ trace, onHighlight }: { trace: SceneTrace; onHighlight(h: NonNullable<Highlight>): void }): JSX.Element {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const tree = sourceTree(trace);
  const flip = (c: string): void => setOpen((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  return (
    <div className="ls-pane">
      <div className="ls-hint"><Ic name="lucide:target" size={12} />Click to highlight in Compose</div>
      <div className="ls-list">
        {tree.length === 0 && <div className="ls-none"><Ic name="lucide:tree-deciduous" size={24} /><p>No source data</p></div>}
        {tree.map((n) => (
          <div key={n.category}>
            <div className="ls-node" style={tone(n.colorVar)} onClick={() => flip(n.category)}>
              <Ic name={open.has(n.category) ? "lucide:chevron-down" : "lucide:chevron-right"} size={12} />
              <span className="ls-name">{n.label}<small>{n.children.length} {n.children.length === 1 ? "block" : "blocks"}</small></span>
              <span className="ls-num">{n.tokens.toLocaleString()}<small>{n.percent}%</small></span>
              <span className="ls-bar"><i style={{ width: `${n.percent}%` }} /></span>
              <IconButton variant="quiet" size="sm" title="Highlight in Compose" label={`Highlight ${n.label} in Compose`} icon="lucide:target" onClick={(e) => { e.stopPropagation(); onHighlight({ category: n.category }); }} />
            </div>
            {open.has(n.category) && n.children.map((c) => (
              <div key={c.index} className="ls-node child" style={tone(n.colorVar)}>
                <span className="ls-name">{c.label}<small>{c.role}</small></span>
                <span className="ls-num">{c.tokens.toLocaleString()}<small>{c.percent}%</small></span>
                <span className="ls-bar"><i style={{ width: `${c.percent}%` }} /></span>
                <IconButton variant="quiet" size="sm" title="Highlight in Compose" label={`Highlight ${c.label} in Compose`} icon="lucide:target" onClick={() => onHighlight({ category: n.category, index: c.index })} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="ls-foot"><span>{tree.length} sources</span><span>{totalTokens(trace).toLocaleString()} total tokens</span></div>
    </div>
  );
}

export function Flow({ trace }: { trace: SceneTrace }): JSX.Element {
  const bars = flowBars(trace);
  return (
    <div className="ls-pane">
      <div className="ls-list">
        <div className="ls-cap">Token Distribution by Source</div>
        {bars.map((b) => (
          <div className="ls-flow" key={b.category} style={tone(b.colorVar)}>
            <div><span>{b.label}</span><span className="ls-num">{b.tokens.toLocaleString()} ({b.percent}%)</span></div>
            <span className="ls-bar thick"><i style={{ width: `${b.percent}%` }} /></span>
          </div>
        ))}
      </div>
      <div className="ls-foot"><span>{bars.length} source types</span><span>{totalTokens(trace).toLocaleString()} total tokens</span></div>
    </div>
  );
}

export function Compose({ trace, highlight, onClear }: { trace: SceneTrace; highlight: Highlight; onClear(): void }): JSX.Element {
  const rows = composeRows(trace);
  const [open, setOpen] = useState<number | null>(null);
  const copied = useFlash<number>(FLASH_MS.copy);
  const lit = highlight ? rows.find((r) => isHighlighted(highlight, r)) : undefined;
  // A highlight from Sources opens the block it points at (RoleCall opens the first section of the source).
  const [seen, setSeen] = useState<Highlight>(null);
  if (highlight !== seen) { setSeen(highlight); if (lit) setOpen(lit.index); }
  return (
    <div className="ls-pane">
      {highlight && <div className="ls-hint"><Chip onClick={onClear}><Ic name="lucide:target" size={12} />Highlighted<Ic name="lucide:x" size={12} /></Chip></div>}
      <div className="ls-list">
        {rows.map((r) => {
          const shown = open === r.index;
          return (
            <div key={r.index} className={`ls-sec${isHighlighted(highlight, r) ? " lit" : ""}`} style={tone(r.colorVar)}>
              <div className="ls-node" onClick={() => setOpen(shown ? null : r.index)}>
                <span className="ls-pos">{r.position}</span>
                <span className="ls-name">{r.label}<small>{r.role}</small></span>
                <span className="ls-num">{r.tokens.toLocaleString()}<small>{r.percent}%</small></span>
                <span className="ls-bar"><i style={{ width: `${r.percent}%` }} /></span>
                <Ic name={shown ? "lucide:chevron-down" : "lucide:chevron-right"} size={14} />
              </div>
              {shown && (
                <div className="ls-body">
                  {r.text === undefined ? <p className="ls-note">Raw text is kept for each take's latest reply; this one shows sizes only.</p> : (
                    <>
                      <span className="ls-copy"><IconButton variant="quiet" size="sm" label="Copy block" icon={copied.value === r.index ? "lucide:check" : "lucide:copy"} onClick={() => { void copyText(r.text!).then((ok) => { if (ok) copied.flash(r.index); }); }} /></span>
                      <pre>{r.text}</pre>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="ls-foot"><span>{rows.length} sections</span><span>{totalTokens(trace).toLocaleString()} total</span></div>
    </div>
  );
}
