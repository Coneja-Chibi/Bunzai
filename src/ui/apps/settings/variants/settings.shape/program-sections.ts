/** settings.shape program-sections (Theater): the tabs as a printed program, small capitals over a rule; the body open, each row ruled off. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("settings.shape", "program-sections", `
& [data-sx="tabs"]{gap:1.4rem;border-bottom:var(--bk-frame-w) solid var(--bk-line-strong)}
& [data-sx="tab"]{background:none;border:0;border-bottom:calc(var(--bk-frame-w)*2) solid transparent;box-shadow:none;padding:.4rem .1rem;font-family:var(--font-fancy);font-variant-caps:all-small-caps;font-weight:500;letter-spacing:.16em;text-transform:none;color:var(--text-soft)}
& [data-sx="tab"]:hover{transform:none;box-shadow:none;color:var(--text)}
& [data-sx="tab"][aria-current="page"]{background:none;color:var(--bk-line-strong);border-bottom-color:var(--bk-line-strong);box-shadow:none}
& [data-sx="body"]{background:none;border:0;box-shadow:none;padding:.4rem 0 1rem}
& [data-sx="row"]{border-bottom:var(--bk-frame-w) solid var(--bk-line-track)}
& [data-sx="label"]{font-family:var(--font-fancy);font-variant-caps:all-small-caps;letter-spacing:.12em;font-weight:500;font-size:1.0625rem}
& [data-sx="hint"]{font-family:var(--font-body);font-weight:400}
& [data-sx="seg"]{border:var(--bk-frame-w) solid var(--control-boundary);box-shadow:none}
& [data-sx="seg"] button{border-left-width:var(--bk-frame-w);font-weight:600;letter-spacing:.06em}
& [data-sx="seg"] button.on{background:var(--selection);color:var(--selection-fg)}
`);
