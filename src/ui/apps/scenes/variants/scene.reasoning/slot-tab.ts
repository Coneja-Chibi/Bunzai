/** scene.reasoning slot-tab (Encore): a numbered label tab breaks the top edge of a thin frame, like a save slot: 01 native, 02 tags. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.reasoning", "slot-tab", `
& .rb{margin-top:12px;background:var(--z-panel)}
& .rb.rb-nat{border:2px solid var(--z-nat-d)}
& .rb.rb-tag{border:1px dashed var(--z-tag-d);margin-left:24px}
& .rb .rb-chip{position:absolute;top:-12px;left:10px}
& .rb.rb-nat .rb-chip{background:var(--z-nat-d);color:var(--z-ondeep)}
& .rb.rb-tag .rb-chip{background:var(--z-panel);color:var(--z-tag-t);border:1px solid var(--z-tag-d);line-height:18px}
& .rb .rb-hd{padding-block:14px 8px}
& .rb .rb-copy{top:11px}
& .rb .rb-cv{color:var(--z-dim)}
& .rb.rb-open .rb-bd{padding:2px 14px 14px}
`, ".scs");
