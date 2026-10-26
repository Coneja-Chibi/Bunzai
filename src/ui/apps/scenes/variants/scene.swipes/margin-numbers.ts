/** scene.swipes margin-numbers (Paper): the version control set as a footnote in typewriter mono, aligned to the page margin. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.swipes", "margin-numbers", `
& .meta{justify-content:flex-start;font-family:var(--font-mono);border-top:var(--bk-frame-w) solid var(--bk-line);padding-top:.35rem}
& .meta .mdl{font-family:var(--font-mono);order:2;margin-left:auto}
& .swc{background:none;border:0;backdrop-filter:none;box-shadow:none;padding:0;font-family:var(--font-mono)}
& .swc .ct::before{content:"["}
& .swc .ct::after{content:"]"}
& .swc .n,& .swc .t{color:var(--text)}
`, ".scs");
