/**
 * The Stage Gallery's styles: RoleCall's two-column grid of square tiles (ImageGalleryPanel.tsx, `grid-cols-2 gap-2`,
 * `aspect-square`) with the hover strip, and the lightbox (portaled to the body, so no `.scs` scope). Colors are theme tokens.
 */
export const GALLERY_STYLE = `
.scs .sg{display:flex;flex-direction:column;gap:12px;flex:1;min-height:0}
.scs .sg-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.scs .sg-count{font:var(--text-meta) var(--font-mono);color:var(--stage-soft)}
.scs .sg-scroll{flex:1;min-height:16rem;overflow-y:auto}
.scs .sg-space{position:relative;width:100%}
.scs .sg-row{position:absolute;top:0;left:0;right:0;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-bottom:8px}
.scs .sg-row [data-control="tile"]{width:auto;height:auto;aspect-ratio:1}
.scs .sg-row [data-control="tile"] .th,.scs .sg-row [data-control="tile"] .th img,.scs .sg-row [data-control="tile"] .th video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.scs .sg-row [data-control="tile"] .strip{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;gap:6px;padding:3px 6px;background:color-mix(in srgb,var(--stage-well) 82%,transparent);color:var(--stage-card);font:var(--rc-text-10, 10px) var(--font-mono);opacity:0;transition:opacity .12s}
.scs .sg-row [data-control="tile"]:hover .strip,.scs .sg-row [data-control="tile"]:focus-visible .strip{opacity:1}
.scs .sg-row [data-control="tile"] .strip b{font-weight:700;text-transform:uppercase;letter-spacing:.08em;flex:none}
.scs .sg-row [data-control="tile"] .strip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .sg-empty{display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;text-align:center;padding:2rem 1rem;color:var(--stage-soft);font:var(--text-body) var(--font-body)}
.scs .sg-empty b{color:var(--stage-card);font:600 var(--text-control) var(--font-big)}
.scs .sg-note{margin:0;font:var(--text-body)/1.4 var(--font-body);color:var(--stage-soft)}
.sgl.sgl{max-width:min(56rem,100%);display:flex;flex-direction:column;gap:12px;max-height:calc(100vh - 2rem)}
.sgl h2{margin:0;font:700 1.1rem var(--font-big)}
.sgl .view{flex:1;min-height:12rem;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--paper-2)}
.sgl .view img,.sgl .view video{max-width:100%;max-height:70vh;object-fit:contain}
.sgl .hint{margin:0;font:400 var(--text-body)/1.4 var(--font-body);color:var(--text-dim)}
.sgl .actions{display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap}
`;
