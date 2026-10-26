/** scene.hud chips (GirliePop): the readout as three sticker chips at the right of the header. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.hud", "chips", `
& .sh{background:var(--stage-well);border-bottom:calc(var(--bk-frame-w)*2) solid var(--bk-line-strong)}
& .sh [data-part="scene.takes.toggle"]{background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);color:var(--text);box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--bk-line-strong)}
& .hudline{position:absolute;top:5px;right:1rem;z-index:36;display:flex;gap:.4rem;max-width:45%;overflow:hidden;font:600 .8125rem/1.4 var(--font-big);color:var(--text)}
& .hudline span{padding:.1rem .6rem;white-space:nowrap;background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong)}
& .hudline small{font-size:.75rem;color:var(--text-dim);margin-right:.2rem}
@container (max-width:1023px){
& .hudline{top:44px;left:0;right:0;height:auto;max-width:none;justify-content:flex-start;padding:.2rem 1rem;background:var(--stage-well);overflow-x:auto}
& .scroll{padding-top:5.5rem}
}
`, ".scs");
