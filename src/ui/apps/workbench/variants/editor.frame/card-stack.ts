/** editor.frame card-stack (GirliePop): the header a sticker card floating over the editor, the editor padded like a stack of cards. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("editor.frame", "card-stack", `
& [data-editor="frame"]{padding:.75rem;gap:1rem;background:var(--stage-well)}
& [data-editor="head"]{background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--bk-line-strong);margin:.25rem .25rem .5rem}
& [data-editor="tabs"]{background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--bk-line-strong);margin:.25rem}

& [data-editor="frame"] [data-ef="layout"]{display:flex;flex-direction:column;gap:1.25rem;max-width:56rem;margin:0 auto;width:100%}
& [data-editor="frame"] [data-ef="rail"],& [data-editor="frame"] [data-ef="section"]{background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--bk-line-strong);padding:1rem}
& [data-editor="frame"] [data-ef="rail"]{max-width:21rem;width:100%;align-self:center}
& [data-editor="frame"] [data-ef="panels"]{display:flex;flex-direction:column;gap:1.25rem}
& [data-editor="frame"] [data-ef="head"]{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin-bottom:.8rem}
& [data-editor="frame"] [data-ef="no"]{padding:0 .6rem;background:var(--stage-row);border:var(--bk-frame-w) solid var(--bk-line-strong);font-family:var(--font-big);font-weight:700;color:var(--text)}
& [data-editor="frame"] [data-ef="title"]{margin:0;font-family:var(--font-big);font-size:var(--text-title);color:var(--text)}
& [data-editor="frame"] [data-ef="hint"]{flex-basis:100%;color:var(--text-dim);font-size:var(--text-meta)}
`);
