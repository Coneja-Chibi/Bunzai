/** settings.shape big-toggles (GirliePop): big sticker tabs, every setting its own slab card, switches and choices made large. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("settings.shape", "big-toggles", `
& [data-sx="tabs"] [role="tablist"]{gap:.7rem}
& [data-sx="body"]{background:none;border:0;box-shadow:none;padding:.4rem .4rem 1.2rem .1rem;gap:1.2rem}
& [data-sx="row"]{padding:1rem 1.2rem;border:var(--bk-frame-w) solid var(--bk-line-strong);background:var(--stage-panel);box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--bk-line-strong);align-items:center}
& [data-sx="row"]:last-child{padding-bottom:1rem;border-bottom:var(--bk-frame-w) solid var(--bk-line-strong)}
& [data-sx="label"]{font-size:1.125rem}
& [data-sx="row"] [role="switch"]{zoom:1.35}
`);
