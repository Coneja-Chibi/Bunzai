/** settings.shape contents-page (Paper): the tabs as a numbered table of contents above a page whose rows are ruled lines of a form. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("settings.shape", "contents-page", `
& [data-sx="room"]{max-width:56rem;margin:0 auto;width:100%}
& [data-sx="tabs"]{padding-bottom:.5rem;border-bottom:var(--bk-frame-w) solid var(--text)}
& [data-sx="tabs"] [role="tablist"]{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:0 2rem;counter-reset:chapter;border-bottom:0;overflow-x:visible}
& [data-sx="tabs"] [role="tab"]{counter-increment:chapter;display:flex;align-items:baseline;gap:.6rem;justify-content:flex-start;text-align:left}
& [data-sx="tabs"] [role="tab"]::before{content:counter(chapter,upper-roman) ".";min-width:2.4rem;font-family:var(--font-mono);font-size:.8125rem;color:var(--text-dim)}
& [data-sx="body"]{background:none;border:0;box-shadow:none;padding:1rem .2rem 1.5rem}
& [data-sx="row"]{border-bottom:var(--bk-frame-w) solid var(--bk-line)}
& [data-sx="label"]{font-family:var(--font-body);font-size:1.0625rem;font-weight:700}
& [data-sx="hint"]{font-family:var(--font-mono);font-size:.8125rem}
`);
