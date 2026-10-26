/** settings.shape options-menu (Encore): the body a bracketed panel with slot-numbered rows. */
import { brackets, variantCss } from "../../../../_shared/variant-css";

export default variantCss("settings.shape", "options-menu", `
& [data-sx="body"]{position:relative;background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);box-shadow:none;padding:clamp(.8rem,2vw,1.4rem);counter-reset:slot}
& [data-sx="body"]::after{content:"";position:absolute;inset:5px;pointer-events:none;background:${brackets("var(--bk-line-strong)", ".7rem")}}
& [data-sx="row"]{counter-increment:slot;border-bottom:var(--bk-frame-w) dashed var(--bk-line-track);padding-left:2.2rem;position:relative}
& [data-sx="row"]::before{content:counter(slot,decimal-leading-zero);position:absolute;left:0;top:.15rem;font:700 .75rem/1.4 var(--font-mono);color:var(--text-dim)}
& [data-sx="label"]{font-family:var(--font-mono);font-size:.875rem;letter-spacing:.06em;text-transform:uppercase}
`);
