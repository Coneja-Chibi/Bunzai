/** scene.swipes arrows-count (Theater): a bare "< 2 / 3 >" in the margin voice, no chrome. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.swipes", "arrows-count", `
& .swc{background:none;border:0;backdrop-filter:none;box-shadow:none;padding:0}
& .swc.new{background:none;box-shadow:none;border:0}
& .swc .ct{font-family:var(--font-body)}
& .meta .mdl{font-family:var(--font-body)}
`, ".scs");
