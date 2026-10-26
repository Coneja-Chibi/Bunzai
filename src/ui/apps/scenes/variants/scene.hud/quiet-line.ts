/** scene.hud quiet-line (Theater): the header as one line over a gold rule; no readout. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.hud", "quiet-line", `
& .sh{background:var(--stage-well);border-bottom:var(--bk-frame-w) solid var(--bk-line-strong)}
& .sh .nm{font-variant-caps:all-small-caps;letter-spacing:.2em;font-size:1.05rem}
& .sh [data-part="scene.takes.toggle"]{background:none;border:var(--bk-frame-w) solid var(--bk-line-strong);color:var(--text)}
`, ".scs");
