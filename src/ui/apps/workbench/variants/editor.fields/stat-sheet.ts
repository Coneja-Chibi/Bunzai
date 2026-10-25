/** editor.fields stat-sheet (Encore): mono capital labels, fields as readout cells with a bright left edge. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("editor.fields", "stat-sheet", `
& [data-editor="frame"] label{font-family:var(--font-mono);font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim)}
& [data-editor="frame"] :is(input:not([type=checkbox],[type=radio],[type=range],[type=color],[type=file]),textarea,select):not([data-editor="head"] *){font-family:var(--font-mono);background:var(--stage-row);border:var(--bk-frame-w) solid var(--bk-line-control);border-left:3px solid var(--bk-line-strong);box-shadow:none}

& [data-editor="frame"] [data-ef="control"]{display:flex;flex-direction:column;gap:.35rem}
& [data-editor="frame"] [data-ef="meter"]{height:.5rem;background:var(--stage-row);border:var(--bk-frame-w) solid var(--bk-line-control)}
& [data-editor="frame"] [data-ef="meter"] i{display:block;height:100%;background:var(--accent)}
& [data-editor="frame"] [data-ef="hint"]{font-family:var(--font-mono)}
`);
