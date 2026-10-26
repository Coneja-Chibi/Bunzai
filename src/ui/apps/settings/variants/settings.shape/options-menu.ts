/** settings.shape options-menu (Encore): a menu list down the left with a marker on the open entry, the body a bracketed panel with slot-numbered rows. */
import { brackets, variantCss } from "../../../../_shared/variant-css";

export default variantCss("settings.shape", "options-menu", `
& [data-sx="room"]{display:grid;grid-template-columns:13rem minmax(0,1fr);grid-template-rows:minmax(0,1fr);align-items:stretch;gap:1rem}
& [data-sx="tabs"]{padding:.5rem;border:var(--bk-frame-w) solid var(--bk-line-strong);background:var(--stage-panel);overflow-y:auto}
& [data-sx="tabs"] [role="tablist"]{flex-direction:column;gap:.2rem;border-bottom:0;overflow-x:visible}
& [data-sx="body"]{position:relative;background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);box-shadow:none;counter-reset:slot}
& [data-sx="body"]::after{content:"";position:absolute;inset:5px;pointer-events:none;background:${brackets("var(--bk-line-strong)", ".7rem")}}
& [data-sx="row"]{counter-increment:slot;border-bottom:var(--bk-frame-w) dashed var(--bk-line-track);padding-left:2.2rem;position:relative}
& [data-sx="row"]::before{content:counter(slot,decimal-leading-zero);position:absolute;left:0;top:.15rem;font:700 .75rem/1.4 var(--font-mono);color:var(--text-dim)}
& [data-sx="label"]{font-family:var(--font-mono);font-size:.875rem;letter-spacing:.06em;text-transform:uppercase}
@container (max-width:44rem){
& [data-sx="room"]{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}
& [data-sx="tabs"] [role="tablist"]{flex-direction:row;flex-wrap:wrap}
}
`);
