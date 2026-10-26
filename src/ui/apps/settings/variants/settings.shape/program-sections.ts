/** settings.shape program-sections (Theater): the tabs as a printed program, small capitals over a rule; the body open, each row ruled off. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("settings.shape", "program-sections", `
& [data-sx="tabs"]{border-bottom:var(--bk-frame-w) solid var(--bk-line-strong)}
& [data-sx="tabs"] [role="tablist"]{gap:1.4rem;border-bottom:0}
& [data-sx="body"]{background:none;border:0;box-shadow:none;padding:.4rem 0 1rem}
& [data-sx="row"]{border-bottom:var(--bk-frame-w) solid var(--bk-line-track)}
& [data-sx="label"]{font-family:var(--font-fancy);font-variant-caps:all-small-caps;letter-spacing:.12em;font-weight:500;font-size:1.0625rem}
& [data-sx="hint"]{font-family:var(--font-body);font-weight:400}
`);
