/** editor.frame long-form (Paper): one centered column of the editor like a long document, the header a ruled title block. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("editor.frame", "long-form", `
& [data-editor="frame"]{background:var(--stage-well);align-items:center}
& [data-editor="frame"]>*{width:100%;max-width:72rem}
& [data-editor="head"]{background:none;border-bottom:var(--bk-frame-w) solid var(--text)}
& [data-editor="tabs"]{background:none;border-bottom:var(--bk-frame-w) dotted var(--bk-line);font-family:var(--font-mono)}

& [data-editor="frame"] [data-ef="layout"]{display:grid;grid-template-columns:11rem minmax(0,44rem);grid-template-areas:"nav rail" "nav panels";justify-content:center;gap:1rem 2rem;padding:1.25rem .9rem;align-items:start}
& [data-editor="frame"] [data-ef="rail"]{grid-area:rail;max-width:21rem}
& [data-editor="frame"] [data-ef="nav"]{grid-area:nav;position:sticky;top:.5rem;display:flex;flex-direction:column;gap:.15rem;border-right:var(--bk-frame-w) dotted var(--bk-line);padding-right:.75rem}
& [data-editor="frame"] [data-ef="tab"]{display:flex;gap:.5rem;align-items:baseline;text-align:left;padding:.2rem 0;border:0;background:none;color:var(--text);font-family:var(--font-mono);font-size:var(--text-meta)}
& [data-editor="frame"] [data-ef="no"]{font-family:var(--font-mono);color:var(--text-soft)}
& [data-editor="frame"] [data-ef="panels"]{grid-area:panels;min-width:0}
& [data-editor="frame"] [data-ef="section"]{padding:1.1rem 0;border-top:var(--bk-frame-w) solid var(--text)}
& [data-editor="frame"] [data-ef="head"]{display:flex;flex-wrap:wrap;align-items:baseline;gap:.2rem .7rem;margin-bottom:.7rem}
& [data-editor="frame"] [data-ef="title"]{margin:0;font-family:var(--font-body);font-style:italic;font-size:var(--text-title);color:var(--text)}
& [data-editor="frame"] [data-ef="hint"]{flex-basis:100%;font-family:var(--font-mono);color:var(--text-soft);font-size:var(--text-meta)}
@container (max-width:46rem){& [data-editor="frame"] [data-ef="layout"]{grid-template-columns:minmax(0,1fr);grid-template-areas:"rail" "nav" "panels"}& [data-editor="frame"] [data-ef="nav"]{position:static;border-right:0;padding-right:0}}
`);
