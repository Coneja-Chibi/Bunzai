/** scene.wings pause-menu (Encore, design/system scene variant B): the rails become labelled menu lists; a wing opens as a framed panel over the dimmed scene. */
import { brackets, variantCss } from "../../../../_shared/variant-css";
import { narrowRail } from "../../narrow-rail";

export default variantCss("scene.wings", "pause-menu", `
& .rail{width:10.5rem;align-items:stretch;gap:.25rem;padding:1rem .6rem;opacity:1;background:var(--stage-panel)}
& .rail::before{display:none}
& .rail::after{background:var(--bk-line-strong);box-shadow:none}
& .scroll,& .dockbar{left:10.5rem;right:10.5rem}
& [data-control="tile"][data-wing]{width:100%;height:auto;min-height:2.5rem;display:flex;justify-content:flex-start;gap:.65rem;padding:.3rem .6rem;color:var(--text);border:var(--bk-frame-w) solid transparent}
& [data-control="tile"][data-wing]::before{display:none}
& [data-control="tile"][data-wing] .lbl{display:inline;font:600 .8125rem/1.2 var(--font-mono);letter-spacing:.08em;text-transform:uppercase}
& [data-control="tile"][data-wing]:hover{border-color:var(--bk-line-strong)}
& [data-control="tile"][data-wing]:hover svg,& [data-control="tile"][data-wing][data-selected] svg{filter:none;transform:none}
& [data-control="tile"][data-wing][data-selected]{background:var(--accent-deep);color:var(--bk-text-on-deep)}
& [data-control="tile"][data-wing] .tip{display:none}
&.open-l .rail.l,&.open-r .rail.r{width:10.5rem}
& .wing-panel.l,& .wing-panel.r{left:10.5rem;right:10.5rem;top:3.25rem;bottom:5.5rem;width:auto;padding:0;border:var(--bk-frame-w) solid var(--bk-line-strong)}
& .wing-panel::after{content:"";position:absolute;inset:5px;pointer-events:none;background:${brackets("var(--bk-line-strong)")}}
& [data-part="scene.paused"]{top:1.1rem;transform:translate(-50%,0)}
& [data-part="scene.paused"] [data-control="tile"]{min-width:0;padding:.3rem .6rem;gap:.2rem}
&.open-l [data-part="scene.paused"],&.open-r [data-part="scene.paused"]{left:50%}
@container (max-width:1023px){
& .scroll,& .dockbar{left:0;right:0}
& .wing-panel.l,& .wing-panel.r{left:0;right:0;top:3rem;bottom:4.5rem}
${narrowRail("&")}}
`, ".scs");
