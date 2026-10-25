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
.scs .bd-act button.chg{flex:none;padding:6px 12px;border:1px solid var(--stage-line);background:var(--stage-row);color:var(--stage-card);font:600 var(--text-control) var(--font-big);cursor:pointer;border-radius:0}
.bdk.bdk{max-width:44rem;display:flex;flex-direction:column;gap:12px;max-height:calc(100vh - 2rem)}
.bdk h2{margin:0;font:700 1.1rem var(--font-big)}
.bdk .bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.bdk .bar input[type=search],.bdk .bar input[type=url]{flex:1;min-width:8rem;padding:6px 8px;border:2px solid var(--edge);background:var(--paper-2);color:var(--text);font:var(--text-control) var(--font-body);border-radius:0}
.bdk .grid{align-content:start;display:grid;grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr));gap:10px;overflow-y:auto;min-height:6rem;padding:2px}
.bdk .tile{position:relative;aspect-ratio:16/10;display:flex;align-items:flex-end;padding:0;border:2px solid var(--edge);background:var(--paper-2);color:var(--text-dim);cursor:pointer;overflow:clip;border-radius:0;text-align:left}
.bdk .tile img,.bdk .tile video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.bdk .tile .cap{position:relative;display:block;width:100%;padding:3px 6px;background:color-mix(in srgb,var(--face) 82%,transparent);color:var(--text);font:var(--text-meta) var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bdk .tile.on{box-shadow:3px 3px 0 0 var(--edge);outline:3px solid var(--accent);outline-offset:1px}
.bdk .tile.none{align-items:center;justify-content:center;border-style:dashed;font:var(--text-control) var(--font-mono)}
.bdk .hint{font:400 var(--text-body)/1.4 var(--font-body);color:var(--text-dim);margin:0}
.bdk .dim{display:flex;gap:10px;align-items:center;font:var(--text-control) var(--font-big)}
.bdk .dim > :last-child{flex:1}
.bdk .actions{display:flex;gap:10px;justify-content:flex-end;align-items:center}
.bd-thumb{position:relative;flex:none;width:6rem;aspect-ratio:16/10;border:2px solid var(--stage-line);background:var(--stage-row);overflow:hidden}
.bd-thumb img,.bd-thumb video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
`;
