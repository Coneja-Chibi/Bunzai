/** settings.shape contents-page (Paper): the tabs as a numbered table of contents above a page whose rows are ruled lines of a form. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("settings.shape", "contents-page", `
& [data-sx="room"]{max-width:56rem;margin:0 auto;width:100%}
& [data-sx="tabs"]{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:0 2rem;counter-reset:chapter;padding-bottom:.5rem;border-bottom:var(--bk-frame-w) solid var(--text)}
& [data-sx="tab"]{counter-increment:chapter;display:flex;align-items:baseline;gap:.6rem;justify-content:flex-start;text-align:left;background:none;border:0;border-bottom:var(--bk-frame-w) dotted var(--bk-line);box-shadow:none;padding:.35rem 0;font-family:var(--font-body);font-size:1rem;font-weight:400;letter-spacing:0;text-transform:none;color:var(--text)}
& [data-sx="tab"]::before{content:counter(chapter,upper-roman) ".";min-width:2.4rem;font-family:var(--font-mono);font-size:.8125rem;color:var(--text-dim)}
& [data-sx="tab"]:hover{transform:none;box-shadow:none;text-decoration:underline;text-underline-offset:.2em}
& [data-sx="tab"][aria-current="page"]{background:none;color:var(--text);font-weight:700;text-decoration:underline;text-underline-offset:.2em;box-shadow:none}
& [data-sx="body"]{background:none;border:0;box-shadow:none;padding:1rem .2rem 1.5rem}
& [data-sx="row"]{border-bottom:var(--bk-frame-w) solid var(--bk-line)}
& [data-sx="label"]{font-family:var(--font-body);font-size:1.0625rem;font-weight:700}
& [data-sx="hint"]{font-family:var(--font-mono);font-size:.8125rem}
& [data-sx="seg"]{border:var(--bk-frame-w) solid var(--text);box-shadow:none}
& [data-sx="seg"] button{border-left:var(--bk-frame-w) solid var(--text);font-family:var(--font-body);font-weight:600;letter-spacing:.02em;text-transform:none}
& [data-sx="seg"] button.on{background:var(--text);color:var(--bk-surface-base)}
`);
