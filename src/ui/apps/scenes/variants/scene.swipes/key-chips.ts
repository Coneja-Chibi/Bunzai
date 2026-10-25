/** scene.swipes key-chips (Encore): the arrows as key caps, the count as a mono slot readout. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.swipes", "key-chips", `
& .swc{gap:.4rem;padding:0;background:none;border:0;backdrop-filter:none}
& .swc button{width:1.75rem;height:1.75rem;border:var(--bk-frame-w) solid var(--bk-line-strong);background:var(--stage-panel);box-shadow:0 2px 0 var(--bk-line-strong);color:var(--text)}
& .swc button:disabled{box-shadow:none;color:var(--stage-line);border-color:var(--bk-line-track)}
& .swc .ct{font-family:var(--font-mono);padding:0 .35rem;border:var(--bk-frame-w) solid var(--bk-line-track)}
& .swc.new{background:none;box-shadow:none}
`, ".scs");
