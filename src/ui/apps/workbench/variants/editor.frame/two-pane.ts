/** editor.frame two-pane (Theater): the editor under a gold-ruled header, tabs and header on one sunk well. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("editor.frame", "two-pane", `
& [data-editor="head"]{border-bottom:var(--bk-frame-w) solid var(--bk-line-strong);background:var(--stage-well)}
& [data-editor="tabs"]{border-bottom:var(--bk-frame-w) solid var(--bk-line)}
& [data-editor="frame"]{background:var(--stage-well)}

& [data-editor="frame"] [data-ef="layout"]{display:grid;grid-template-columns:16rem minmax(0,1fr);grid-template-areas:"nav panels" "rail panels";grid-template-rows:auto 1fr;gap:1rem;padding:1rem .9rem;align-items:start}
& [data-editor="frame"] [data-ef="rail"]{grid-area:rail}
& [data-editor="frame"] [data-ef="nav"]{grid-area:nav;display:flex;flex-direction:column;background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong)}
& [data-editor="frame"] [data-ef="tab"]{display:flex;gap:.6rem;align-items:baseline;text-align:left;padding:.55rem .8rem;border:0;border-bottom:var(--bk-frame-w) solid var(--bk-line);background:transparent;color:var(--text)}
& [data-editor="frame"] [data-ef="tab"][aria-selected="true"]{background:var(--stage-row);box-shadow:inset 4px 0 0 var(--accent)}
& [data-editor="frame"] [data-ef="no"]{font-family:var(--font-mono);color:var(--text-dim)}
& [data-editor="frame"] [data-ef="panels"]{grid-area:panels;min-width:0;padding:1rem 1.25rem;background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong)}
& [data-editor="frame"] [data-ef="head"]{display:flex;align-items:baseline;gap:.6rem;margin-bottom:.9rem;padding-bottom:.5rem;border-bottom:var(--bk-frame-w) solid var(--bk-line-strong)}
& [data-editor="frame"] [data-ef="title"]{margin:0;font-family:var(--font-big);font-size:var(--text-title);color:var(--text)}
& [data-editor="frame"] [data-ef="hint"]{margin-left:auto;color:var(--text-dim);font-size:var(--text-meta)}
& [data-editor="frame"] [data-ef="layout"]:where([data-rail="wide"]){grid-template-columns:26rem minmax(0,1fr)}
@container (max-width:46rem){& [data-editor="frame"] [data-ef="layout"]{grid-template-columns:minmax(0,1fr);grid-template-areas:"rail" "nav" "panels"}}
`);
