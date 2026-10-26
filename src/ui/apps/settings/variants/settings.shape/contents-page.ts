/** settings.shape contents-page (Paper): a page whose rows are ruled lines of a form. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("settings.shape", "contents-page", `
& [data-sx="room"]{max-width:56rem;margin:0 auto;width:100%}
& [data-sx="body"]{background:none;border:0;box-shadow:none;padding:1rem .2rem 1.5rem}
& [data-sx="row"]{border-bottom:var(--bk-frame-w) solid var(--bk-line)}
& [data-sx="label"]{font-family:var(--font-body);font-size:1.0625rem;font-weight:700}
& [data-sx="hint"]{font-family:var(--font-mono);font-size:.8125rem}
`);
