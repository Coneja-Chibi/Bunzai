/** scene.wings drawer (GirliePop): the wings are a row of big labelled tabs under the header; a wing opens as a drawer rising from the bottom. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.wings", "drawer", `
& .rail{top:44px;bottom:auto;height:3.5rem;width:auto;flex-direction:row;align-items:center;gap:.45rem;padding:.4rem .75rem;opacity:1;overflow-x:auto;background:var(--stage-well);border-bottom:var(--bk-frame-w) solid var(--bk-line)}
& .rail.l{left:0;right:50%;justify-content:safe flex-end}
& .rail.r{left:50%;right:0;justify-content:flex-start}
& .rail::before{display:none}
& .rail::after{display:none}
& .wi{width:auto;height:2.5rem;display:flex;flex:none;gap:.4rem;padding:0 .75rem;border:var(--bk-frame-w) solid var(--bk-line-strong);background:var(--stage-panel);color:var(--text);box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--bk-line-strong)}
& .wi::before{display:none}
& .wi .lbl{display:inline;font:700 .8125rem/1 var(--font-big)}
& .wi:hover svg,& .wi.on svg{filter:none;transform:none}
& .wi.on{background:var(--action-primary);color:var(--action-primary-fg)}
& .wi .tip{display:none}
&.open-l .rail.l,&.open-r .rail.r{width:auto}
& .scroll{left:0;right:0;top:100px;padding-top:1.5rem}
& .wing-panel.l,& .wing-panel.r{left:0;right:0;top:auto;bottom:0;width:auto;height:min(76%,42rem);padding:0;border:0;border-top:calc(var(--bk-frame-w)*2) solid var(--bk-line-strong);box-shadow:0 calc(var(--bk-frame-shadow-y)*-1) 0 var(--bk-line-strong)}
@container (max-width:1023px){
& .scroll{top:0;padding-top:4.5rem}
}
& .paused-mark{top:10rem;transform:translate(-50%,0)}
&.open-l .paused-mark,&.open-r .paused-mark{left:50%}
@media (prefers-reduced-motion:no-preference){
& .wing-panel{animation:scs-drawer calc(var(--bk-dur-base)*1.5) var(--bk-ease-move) 1 both}
}
@keyframes scs-drawer{from{transform:translateY(100%)}to{transform:none}}
`, ".scs");
