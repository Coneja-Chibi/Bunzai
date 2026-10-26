/** editor.frame tabbed-menu (Encore): the editor inside a slab frame, the header a menu bar in mono capitals, the lens tabs a row of framed menu entries. */
import { brackets, variantCss } from "../../../../_shared/variant-css";

export default variantCss("editor.frame", "tabbed-menu", `
& [data-editor="frame"]{border:2px solid var(--bk-line-strong);background:var(--stage-well)}
& [data-editor="head"]{position:relative;background:var(--stage-panel);border-bottom:2px solid var(--bk-line-strong);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em}
& [data-editor="head"]::after{content:"";position:absolute;inset:3px;pointer-events:none;background:${brackets("var(--bk-line-strong)", ".6rem")}}
& [data-editor="tabs"]{background:var(--stage-row);border-bottom:var(--bk-frame-w) solid var(--bk-line-strong);font-family:var(--font-mono)}

& [data-editor="frame"] [data-ef="layout"]{display:grid;grid-template-columns:16rem minmax(0,1fr);grid-template-areas:"rail nav" "rail panels";grid-template-rows:auto 1fr;gap:.75rem 1rem;padding:1rem .9rem;align-items:start}
& [data-editor="frame"] [data-ef="rail"]{grid-area:rail}
& [data-editor="frame"] [data-ef="nav"]{grid-area:nav;display:flex;flex-wrap:wrap;gap:.4rem;padding:.4rem;background:var(--stage-row);border:2px solid var(--bk-line-strong)}
& [data-editor="frame"] [data-ef="tab"]{display:flex;gap:.45rem;align-items:baseline;padding:.35rem .7rem;background:var(--stage-panel);color:var(--text);border:var(--bk-frame-w) solid var(--bk-line-strong);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em}
& [data-editor="frame"] [data-ef="tab"][aria-selected="true"]{box-shadow:inset 0 -4px 0 var(--accent)}
& [data-editor="frame"] [data-ef="tab"][aria-selected="true"]::before{content:"▸"}
& [data-editor="frame"] [data-ef="no"]{color:var(--text-dim)}
& [data-editor="frame"] [data-ef="panels"]{grid-area:panels;min-width:0;padding:1rem;background:var(--stage-panel);border:2px solid var(--bk-line-strong)}
& [data-editor="frame"] [data-ef="head"]{display:flex;flex-wrap:wrap;align-items:baseline;gap:.2rem .6rem;margin-bottom:.8rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em}
& [data-editor="frame"] [data-ef="title"]{margin:0;font-size:var(--text-body);color:var(--text)}
& [data-editor="frame"] [data-ef="hint"]{flex-basis:100%;text-transform:none;letter-spacing:0;color:var(--text-dim);font-size:var(--text-meta)}
& [data-editor="frame"] [data-ef="layout"]:where([data-rail="wide"]){grid-template-columns:26rem minmax(0,1fr)}
& [data-editor="frame"] [data-ef="layout"]:where([data-rail="none"]){grid-template-columns:minmax(0,1fr);grid-template-areas:"nav" "panels"}
@container (max-width:46rem){& [data-editor="frame"] [data-ef="layout"]{grid-template-columns:minmax(0,1fr);grid-template-areas:"rail" "nav" "panels"}}
`);
