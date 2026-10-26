/** scene.wings marginalia (Paper): the wings are a ruled index of words in each margin; a wing opens as a ruled sheet beside the page. */
import { variantCss } from "../../../../_shared/variant-css";
import { narrowRail } from "../../narrow-rail";

export default variantCss("scene.wings", "marginalia", `
& .rail{width:9rem;align-items:stretch;gap:0;padding:5rem .9rem 1rem;opacity:1}
& .rail::before{display:none}
& .rail::after{background:var(--bk-line);box-shadow:none}
& .scroll,& .dockbar{left:9rem;right:9rem}
& [data-control="tile"][data-wing]{width:100%;height:auto;display:flex;justify-content:flex-start;gap:.55rem;padding:.4rem 0;color:var(--text);border-bottom:var(--bk-frame-w) dotted var(--bk-line)}
& [data-control="tile"][data-wing] svg{width:1rem;height:1rem}
& [data-control="tile"][data-wing]::before{display:none}
& [data-control="tile"][data-wing] .lbl{display:inline;font:500 .8125rem/1.2 var(--font-mono)}
& [data-control="tile"][data-wing]:hover svg,& [data-control="tile"][data-wing][data-selected] svg{filter:none;transform:none}
& [data-control="tile"][data-wing][data-selected] .lbl{text-decoration:underline;text-underline-offset:.25em;font-weight:700}
& [data-control="tile"][data-wing] .tip{display:none}
&.open-l .rail.l,&.open-r .rail.r{width:9rem}
& .wing-panel.l{left:9rem;width:min(44rem,calc(100% - 18rem));padding-left:0;border-right:var(--bk-frame-w) solid var(--text);border-left:var(--bk-frame-w) solid var(--text)}
& .wing-panel.r{right:9rem;width:min(40rem,calc(100% - 18rem));padding-right:0;border-left:var(--bk-frame-w) solid var(--text);border-right:var(--bk-frame-w) solid var(--text)}
& .hero .eb,& .dcard .np,& .hero h2 em{color:var(--text)}
& .dcard .np{border-color:var(--bk-line)}
&.open-l [data-part="scene.paused"]{left:auto;right:1.5rem;top:auto;bottom:7rem;transform:none}
&.open-r [data-part="scene.paused"]{left:1.5rem;top:auto;bottom:7rem;transform:none}
@container (max-width:1023px){
& .scroll,& .dockbar{left:0;right:0}
& .wing-panel.l,& .wing-panel.r{left:0;right:0;width:100%}
${narrowRail("&")}}
`, ".scs");
