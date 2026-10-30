/** editor.fields labeled-rows (Theater): small-capital labels over hairline fields in the body face. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("editor.fields", "labeled-rows", `
& [data-editor="frame"] label{font-variant-caps:all-small-caps;letter-spacing:.1em}
& [data-editor="frame"] :is(input:not([type=checkbox],[type=radio],[type=range],[type=color],[type=file]),textarea,select):not([data-editor="head"] *){border:var(--bk-frame-w) solid var(--control-boundary);box-shadow:none;font-family:var(--font-body);background:var(--bk-surface-ink);color:var(--text);min-width:0;max-width:100%}

& [data-editor="frame"] [data-ef="field"]{display:grid;grid-template-columns:clamp(5.5rem,30%,10rem) minmax(0,1fr);gap:.2rem 1rem;align-items:start}
& [data-editor="frame"] [data-ef="field"][data-wide]{grid-template-columns:minmax(0,1fr)}
& [data-editor="frame"] [data-ef="label"]{padding-top:.4rem}
& [data-editor="frame"] [data-ef="hint"]{grid-column:2}
& [data-editor="frame"] [data-ef="field"][data-wide] > [data-ef]{grid-column:1 / -1}
`);
