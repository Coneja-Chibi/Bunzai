/** scene.hud footnotes (Paper): the readout as a mono footnote line, ruled off at the right of the header. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.hud", "footnotes", `
& .sh{background:var(--stage-well);border-bottom:var(--bk-frame-w) solid var(--bk-line)}
& .sh .branch{background:none;border:0;border-bottom:var(--bk-frame-w) solid var(--text);color:var(--text);padding:.1rem .15rem}
& .sh .nm{font-family:var(--font-mono);letter-spacing:.06em}
& .hudline{position:absolute;top:0;right:1rem;z-index:36;height:44px;display:flex;align-items:center;gap:.9rem;font:500 .75rem/1.4 var(--font-mono);color:var(--text-soft);white-space:nowrap;max-width:45%;overflow:hidden}
& .hudline small::after{content:":"}
@container (max-width:1023px){
& .hudline{top:44px;left:0;right:0;height:auto;max-width:none;justify-content:flex-start;padding:.2rem 1rem;background:var(--stage-well);overflow-x:auto}
& .scroll{padding-top:5.5rem}
}
`, ".scs");
