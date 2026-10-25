/** scene.reasoning footnote (Paper): no frame and no fill; a hairline rule and a numeral like notes at the foot of a page, a double rule for native and a dashed numeral for tags. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.reasoning", "footnote", `
& .rb{background:none;border-top:1px solid var(--z-strong)}
& .rb.rb-nat{border-top:3px double var(--z-strong)}
& .rb .rb-hd{padding-block:8px;padding-left:0}
& .rb .rb-copy{top:6px;background:none}
& .rb .rb-chip{padding:0;text-transform:none;letter-spacing:0;font-family:var(--z-serif);font-size:14px;font-weight:700;color:var(--z-text)}
& .rb .rb-no{display:inline-grid;place-items:center;min-width:20px;height:20px;border:1px solid var(--z-strong);margin-right:8px;font-size:12px}
& .rb.rb-nat .rb-no{background:var(--z-nat-d);border-color:var(--z-nat-d);color:var(--z-ondeep)}
& .rb.rb-tag .rb-no{background:none;border-color:var(--z-tag-d);color:var(--z-tag-t);border-style:dashed}
& .rb .rb-cv{color:var(--z-dim)}
& .rb.rb-open .rb-bd{padding:4px 0 14px 28px}
`, ".scs");
