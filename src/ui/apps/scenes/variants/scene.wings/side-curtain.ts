/** scene.wings side-curtain (Theater): quiet icon rails on a gold hairline; a wing opens as a curtain panel from its side. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.wings", "side-curtain", `
& .rail::before{backdrop-filter:none;background:var(--stage-well);-webkit-mask-image:none;mask-image:none}
& .rail::after{background:var(--bk-line-strong);box-shadow:none}
& [data-control="tile"][data-wing]::before{display:none}
& [data-control="tile"][data-wing]:hover svg,& [data-control="tile"][data-wing][data-selected] svg{filter:none}
& [data-control="tile"][data-wing][data-selected]{color:var(--bk-line-strong);box-shadow:inset 0 calc(var(--bk-frame-w)*-2) 0 var(--bk-line-strong)}
& .tip{border:var(--bk-frame-w) solid var(--bk-line-strong);box-shadow:none}
& .tip b{text-shadow:none;font-weight:600}
& .wing-panel.l{border-right:var(--bk-frame-w) solid var(--bk-line-strong)}
& .wing-panel.r{border-left:var(--bk-frame-w) solid var(--bk-line-strong)}
`, ".scs");
