/** editor.fields cards (GirliePop; the contents search label draws one box and the input inside it stays bare): every field a slab card with a stamp shadow, every label a small sticker. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("editor.fields", "cards", `
& [data-editor="frame"] label{display:inline-block;padding:.05rem .6rem;background:var(--stage-row);border:var(--bk-frame-w) solid var(--bk-line-track);font-family:var(--font-big);font-weight:700;color:var(--text)}
& [data-editor="frame"] :is(input:not([type=checkbox],[type=radio],[type=range],[type=color],[type=file]),textarea,select):not([data-editor="head"] *){background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--bk-line-strong);padding:.6rem .8rem}

& [data-editor="frame"] label[class*="tocSearch"]{display:flex;align-items:center;gap:.4rem;padding:.3rem .6rem;background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--bk-line-strong)}
& [data-editor="frame"] label[class*="tocSearch"] input{border:0 !important;box-shadow:none !important;background:none !important;padding:.1rem 0;flex:1;min-width:0}

& [data-editor="frame"] [data-ef="field"]{padding:.7rem .8rem;background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--bk-line-strong)}
& [data-editor="frame"] [data-ef="label"]{align-self:flex-start;padding:.05rem .6rem;background:var(--stage-row);border:var(--bk-frame-w) solid var(--bk-line-track);font-family:var(--font-big);font-weight:700;color:var(--text)}
`);
