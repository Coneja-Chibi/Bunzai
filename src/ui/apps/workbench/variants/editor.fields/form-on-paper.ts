/** editor.fields form-on-paper (Paper): fields as ruled lines on the page, long text on ruled paper, labels as typewriter footnotes. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("editor.fields", "form-on-paper", `
& [data-editor="frame"] label{font-family:var(--font-mono);font-size:.75rem;letter-spacing:.04em;color:var(--text-soft)}
& [data-editor="frame"] :is(input:not([type=checkbox],[type=radio],[type=range],[type=color],[type=file]),textarea,select):not([data-editor="head"] *){background:transparent;border:0;border-bottom:var(--bk-frame-w) solid var(--text);box-shadow:none;font-family:var(--font-body)}
& [data-editor="frame"] textarea{line-height:1.7rem;background-image:repeating-linear-gradient(transparent 0 calc(1.7rem - var(--bk-frame-w)),var(--bk-line-track) calc(1.7rem - var(--bk-frame-w)) 1.7rem)}

& [data-editor="frame"] [data-ef="field"]{display:grid;grid-template-columns:8rem minmax(0,1fr);gap:.1rem 1rem;align-items:end;border-bottom:var(--bk-frame-w) solid var(--bk-line-track)}
& [data-editor="frame"] [data-ef="field"][data-wide]{grid-template-columns:minmax(0,1fr)}
& [data-editor="frame"] [data-ef="label"]{text-align:right;font-family:var(--font-mono);font-size:var(--text-meta);color:var(--text-soft)}
& [data-editor="frame"] [data-ef="hint"]{grid-column:2;font-family:var(--font-mono);font-style:italic}
& [data-editor="frame"] [data-ef="field"][data-wide] > [data-ef]{grid-column:1 / -1}
`);
