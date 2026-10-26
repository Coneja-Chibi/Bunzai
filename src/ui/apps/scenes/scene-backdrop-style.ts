/**
 * The scene backdrop's styles (approved wireframe design/wireframes/backdrops/index.html): the picture layer under
 * the messages, the Stage wing's Backdrop row, and the picker dialog (portaled to the body, so no `.scs` scope).
 * The picture sits above the page's own `.bgm` and below the theme's `scene.backdrop` slot; its overlay is the theme's
 * well color (scene-backdrop-core.ts veilOf), so text keeps the contrast the theme chose for its own surface.
 */
export const BACKDROP_STYLE = `
.scs .bdp{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.scs .bdp img,.scs .bdp video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center}
.scs .bdp .veil{position:absolute;inset:0}
.scs .bdp::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 50%,color-mix(in srgb,var(--stage-well) 65%,transparent))}
.scs .bd-act{display:flex;gap:10px;align-items:center}
.bdk.bdk{max-width:44rem;display:flex;flex-direction:column;gap:12px;max-height:calc(100vh - 2rem)}
.bdk h2{margin:0;font:700 1.1rem var(--font-big)}
.bdk .bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.bdk .bar input[type=search],.bdk .bar input[type=url]{flex:1;min-width:8rem;padding:6px 8px;border:2px solid var(--edge);background:var(--paper-2);color:var(--text);font:var(--text-control) var(--font-body);border-radius:0}
.bdk .gscroll{overflow-y:auto;min-height:6rem;padding:2px}
.bdk .grow{align-content:start;display:grid;grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr));gap:10px}
.bdk .grow [data-control="tile"]{width:100%;height:auto;aspect-ratio:16/10}
.bdk [data-control="tile"] img,.bdk [data-control="tile"] video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.bdk [data-control="tile"] .cap{position:absolute;left:0;bottom:0;display:block;width:100%;height:auto;padding:3px 6px;background:color-mix(in srgb,var(--face) 82%,transparent);color:var(--text);font:var(--text-meta) var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bdk .hint{font:400 var(--text-body)/1.4 var(--font-body);color:var(--text-dim);margin:0}
.bdk .dim{display:flex;gap:10px;align-items:center;font:var(--text-control) var(--font-big)}
.bdk .dim > :last-child{flex:1}
.bdk .actions{display:flex;gap:10px;justify-content:flex-end;align-items:center}
.bd-thumb{position:relative;flex:none;width:6rem;aspect-ratio:16/10;border:2px solid var(--stage-line);background:var(--stage-row);overflow:hidden}
.bd-thumb img,.bd-thumb video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
`;
