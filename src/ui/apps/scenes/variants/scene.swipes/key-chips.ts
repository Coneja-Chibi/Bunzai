/** scene.swipes key-chips (Encore): the arrows as key caps (through the button family's data-control hook), the count as a mono slot readout. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.swipes", "key-chips", `
& .swc{gap:.4rem;padding:0;background:none;border:0;backdrop-filter:none}
& .swc [data-control="icon"]{width:1.75rem;height:1.75rem;min-height:0;padding:0;--sx:0px;--sy:2px;--sh:var(--bk-line-strong);border:var(--bk-frame-w) solid var(--bk-line-strong);background:var(--stage-panel);color:var(--text)}
& .swc [data-control="icon"]:disabled{box-shadow:none;color:var(--stage-line);border-color:var(--bk-line-track)}
& .swc .ct{font-family:var(--font-mono);padding:0 .35rem;border:var(--bk-frame-w) solid var(--bk-line-track)}
& .swc.new{background:none;box-shadow:none}
`, ".scs");
