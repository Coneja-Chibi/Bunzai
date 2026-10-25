/**
 * TrackHare's Tokens sheet (the itemizer): exactly what a reply sent, section by section (approved
 * wireframe design/wireframes/props/trackhare.html?state=tokens). Later the Context wing's trace viewer
 * reuses this component as-is: no TrackHare-specific assumptions beyond the `SceneTrace` it is given.
 *
 * The header's hare logo is T2a's `./hare-logo`.
 */
import { useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import type { SceneTrace, TraceBlockView, TraceCategory } from "../../../../app-contract-scenes";
import { copyText } from "../../../../_shared/clipboard";
import { exportBlob, triggerDownload } from "../../../../components/export-dialog/download";
import { DialogCore } from "../../../../components/dialog-core";
import { Ic } from "../../../../_shared/ic";
import { HareLogo } from "./hare-logo";
import {
  budgetSegments, categoryTotals, CATEGORY_COLOR_VARS, CATEGORY_LABELS, effectiveTokens, gradientStops, legendOrder,
  loreBookGroups, numberRanges, rawRequestText, traceJsonText, usedPercent,
} from "./tokens-core";

/** The category header's parenthetical: block/message count, and the trimmed and summarized notes for chat history. */
function catMeta(cat: TraceCategory, count: number, trimmed: number, summarized: readonly number[] = []): string {
  if (cat === "history") {
    const left = trimmed > 0 ? `, ${trimmed} left out for space` : "";
    const replaced = summarized.length > 0 ? `, messages ${numberRanges(summarized)} replaced by summaries` : "";
    return `${count} message${count === 1 ? "" : "s"}${left}${replaced}`;
  }
  if (cat === "lore") return `${count} entr${count === 1 ? "y" : "ies"}`;
  return `${count}`;
}

export function TokensSheet({ trace, model, onClose }: { trace: SceneTrace; model: string; onClose(): void }): JSX.Element {
  const sheetRef = useRef<HTMLElement | null>(null);
  const totals = useMemo(() => categoryTotals(trace.blocks), [trace]);
  const defaultOrder = useMemo(() => legendOrder(totals), [totals]);
  const [order, setOrder] = useState<TraceCategory[]>(defaultOrder);
  const [excluded, setExcluded] = useState<ReadonlySet<TraceCategory>>(new Set());
  const [collapsed, setCollapsed] = useState<ReadonlySet<TraceCategory>>(new Set());
  const [openBlocks, setOpenBlocks] = useState<ReadonlySet<number>>(new Set());
  const dragCat = useRef<TraceCategory | null>(null);

  const effective = effectiveTokens(totals, excluded);
  const stops = gradientStops(totals, order, excluded);
  const segments = budgetSegments(totals, order, excluded, trace.window.context);
  const gradient = stops.length > 0
    ? `conic-gradient(${stops.map((s) => `var(${s.colorVar}) ${s.startPct}% ${s.endPct}%`).join(",")})`
    : "var(--stage-seam)";
  const usedPct = usedPercent(effective, trace.window.context);
  const hasWhatIf = excluded.size > 0 || order.join() !== defaultOrder.join();

  const resetWhatIf = (): void => {
    setExcluded(new Set());
    setOrder(defaultOrder);
  };
  const toggleExcluded = (cat: TraceCategory): void => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };
  const toggleCollapsed = (cat: TraceCategory): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };
  const toggleOpenBlock = (i: number): void => {
    setOpenBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };
  const onLegendDrop = (target: TraceCategory): void => {
    const src = dragCat.current;
    dragCat.current = null;
    if (!src || src === target) return;
    setOrder((prev) => {
      const next = prev.filter((c) => c !== src);
      const at = next.indexOf(target);
      next.splice(at, 0, src);
      return next;
    });
  };

  const baseName = `bunraku-reply-${trace.reply.number}`;
  const rawText = rawRequestText(trace);
  const exportJson = (): void => {
    const { blob, filename } = exportBlob({ suggestedExtension: "json", text: traceJsonText(trace) }, baseName);
    triggerDownload(blob, filename);
  };
  const exportTxt = (): void => {
    if (!rawText) return;
    const { blob, filename } = exportBlob({ suggestedExtension: "txt", text: rawText }, baseName);
    triggerDownload(blob, filename);
  };

  /** One block's section row: label (a Copy-to-expand toggle when raw text is kept), tokens, and its
   * expanded raw text. Shared by the flat categories and the Lore card's book sub-groups. */
  const row = (b: TraceBlockView, i: number): JSX.Element => {
    const open = openBlocks.has(i);
    return (
      <div className="tok-sec" key={i}>
        {trace.rawAvailable
          ? <button type="button" className="tok-sec-open" onClick={() => toggleOpenBlock(i)} aria-expanded={open}>{b.label}</button>
          : <span className="tok-sec-lbl">{b.label}</span>}
        <em>{b.tokens.toLocaleString()}</em>
        {open && b.text !== undefined && (
          <div className="tok-raw">
            {b.text}
            <div className="tok-raw-ft">
              <button type="button" className="tok-btn" onClick={() => copyText(b.text ?? "")}>Copy</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <DialogCore
      placement="embedded"
      onDismiss={onClose}
      ariaLabel="Tokens"
      as="section"
      sheetRef={sheetRef}
      className="tok-sheet"
      tabIndex={-1}
      dismissOnScrim={false}
    >
      <div className="tok-hd">
        <span className="tok-logo" aria-hidden="true"><HareLogo size={18} /></span>
        <b>Tokens</b>
        <small>Reply #{trace.reply.number} &middot; exactly what was sent, section by section</small>
        <span className="tok-grow" />
        <button type="button" className="tok-close" aria-label="Close" onClick={onClose}>&times;</button>
      </div>
      <div className="tok-body">
        <aside className="tok-side">
          <div className="tok-donut" style={{ background: gradient }}>
            <b>{effective.toLocaleString()}<small>tokens sent</small></b>
          </div>
          <div className="tok-leg">
            {order.map((cat) => (
              <button
                type="button"
                key={cat}
                className={`tok-legrow${excluded.has(cat) ? " tok-x" : ""}`}
                draggable
                onDragStart={() => { dragCat.current = cat; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onLegendDrop(cat)}
                onClick={() => toggleExcluded(cat)}
                aria-pressed={excluded.has(cat)}
                title={excluded.has(cat) ? `Include ${CATEGORY_LABELS[cat]}` : `Leave out ${CATEGORY_LABELS[cat]}`}
              >
                <span className="tok-sw" style={{ "--c": `var(${CATEGORY_COLOR_VARS[cat]})` } as CSSProperties} />
                <span className="tok-nm">{CATEGORY_LABELS[cat]}</span>
                <em>{totals[cat].toLocaleString()}</em>
                <span className="tok-grip" aria-hidden="true">::</span>
              </button>
            ))}
          </div>
          <div className="tok-bud">
            <small>
              Context: {effective.toLocaleString()} of {trace.window.context.toLocaleString()} (reply keeps {trace.window.reply.toLocaleString()})
              {!trace.window.stated && " (estimated window)"}
            </small>
            <div className="tok-bar">
              {segments.map((s) => <i key={s.category} style={{ "--c": `var(${s.colorVar})`, width: `${s.widthPct}%` } as CSSProperties} />)}
            </div>
            <div className="tok-bl">
              <span>{usedPct.toFixed(0)}% used</span>
              {trace.lore && <span>lore share: {trace.lore.totalTokens.toLocaleString()} of {trace.lore.share.toLocaleString()}</span>}
            </div>
          </div>
          <div className="tok-bud">
            <small>Counting with</small>
            <div className="tok-model">This scene&apos;s model ({model})</div>
          </div>
        </aside>
        <div className="tok-main">
          {!trace.rawAvailable && (
            <p className="tok-note">
              <Ic name="lucide:circle-alert" size={14} />
              Raw text is kept for each take&apos;s latest reply; this one shows sizes only.
            </p>
          )}
          {order.map((cat) => {
            const rows = trace.blocks.map((b, i) => ({ b, i })).filter((r) => r.b.category === cat);
            const isCollapsed = collapsed.has(cat);
            // th-t4-gaps 4: the Preset prompts card names the scene's preset instead of a block count,
            // when the trace carries one (an old trace, or no preset chosen, keeps the plain count).
            const header = cat === "preset" && trace.presetName ? trace.presetName : catMeta(cat, rows.filter((r) => r.b.kind !== "summary").length, trace.trimmed, trace.summarized);
            return (
              <div className="tok-cat" key={cat} style={{ "--c": `var(${CATEGORY_COLOR_VARS[cat]})` } as CSSProperties}>
                <button type="button" className={`tok-ch${isCollapsed ? " tok-closed" : ""}`} onClick={() => toggleCollapsed(cat)} aria-expanded={!isCollapsed}>
                  <Ic name="lucide:chevron-down" size={12} />
                  {CATEGORY_LABELS[cat]} ({header})
                  <em>{totals[cat].toLocaleString()}</em>
                </button>
                {!isCollapsed && (cat === "lore"
                  // th-t4-gaps 4: Lore sub-groups under the book each entry came from.
                  ? loreBookGroups(trace.blocks, trace.lore).map((g) => (
                    <div key={g.bookName || "_"}>
                      {g.bookName && <div className="tok-bkh">{g.bookName}</div>}
                      {g.rows.map((r) => row(r.block, r.index))}
                    </div>
                  ))
                  : rows.map(({ b, i }) => row(b, i)))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="tok-ft">
        <button type="button" className="tok-btn" onClick={() => copyText(traceJsonText(trace))}>Copy as JSON</button>
        {rawText && <button type="button" className="tok-btn" onClick={() => copyText(rawText)}>Copy the raw request</button>}
        <button type="button" className="tok-btn" onClick={exportJson}>Export .json</button>
        {rawText && <button type="button" className="tok-btn" onClick={exportTxt}>Export .txt</button>}
        <span className="tok-grow" />
        <button type="button" className="tok-btn" onClick={resetWhatIf} disabled={!hasWhatIf}>Reset what-if</button>
      </div>
    </DialogCore>
  );
}
