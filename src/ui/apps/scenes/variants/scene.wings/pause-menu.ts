/** scene.wings pause-menu (Encore, design/system scene variant B): the rails become labelled menu lists; a wing opens as a framed panel over the dimmed scene. */
import { brackets, variantCss } from "../../../../_shared/variant-css";
import { narrowRail } from "../../narrow-rail";

export default variantCss("scene.wings", "pause-menu", `
& .rail{width:10.5rem;align-items:stretch;gap:.25rem;padding:1rem .6rem;opacity:1;background:var(--stage-panel)}
& .rail::before{display:none}
& .rail::after{background:var(--bk-line-strong);box-shadow:none}
& .scroll,& .dockbar{left:10.5rem;right:10.5rem}
& .wi{width:100%;height:auto;min-height:2.5rem;display:flex;justify-content:flex-start;gap:.65rem;padding:.3rem .6rem;color:var(--text);border:var(--bk-frame-w) solid transparent}
& .wi::before{display:none}
& .wi .lbl{display:inline;font:600 .8125rem/1.2 var(--font-mono);letter-spacing:.08em;text-transform:uppercase}
& .wi:hover{border-color:var(--bk-line-strong)}
& .wi:hover svg,& .wi.on svg{filter:none;transform:none}
& .wi.on{background:var(--accent-deep);color:var(--bk-text-on-deep)}
& .wi .tip{display:none}
&.open-l .rail.l,&.open-r .rail.r{width:10.5rem}
& .wing-panel.l,& .wing-panel.r{left:10.5rem;right:10.5rem;top:3.25rem;bottom:5.5rem;width:auto;padding:0;border:var(--bk-frame-w) solid var(--bk-line-strong)}
& .wing-panel::after{content:"";position:absolute;inset:5px;pointer-events:none;background:${brackets("var(--bk-line-strong)")}}
& .paused-mark{top:1.1rem;transform:translate(-50%,0)}
& .paused-mark .sq{width:2rem;height:2rem}
& .paused-mark small{margin-top:.2rem}
&.open-l .paused-mark,&.open-r .paused-mark{left:50%}
@container (max-width:1023px){
& .scroll,& .dockbar{left:0;right:0}
& .wing-panel.l,& .wing-panel.r{left:0;right:0;top:3rem;bottom:4.5rem}
${narrowRail("&")}}
`, ".scs");
