/** scene.reasoning program-note (Theater): a thin margin bar down the left edge, flush for native and indented and dashed for tags, like a program note. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.reasoning", "program-note", `
& .rb{background:var(--z-panel)}
& .rb.rb-nat{border-left:4px solid var(--z-nat-d)}
& .rb.rb-tag{margin-left:24px;border-left:2px dashed var(--z-tag-d)}
& .rb.rb-nat .rb-chip{background:var(--z-nat-d);color:var(--z-ondeep)}
& .rb.rb-tag .rb-chip{color:var(--z-tag-t);border:1px solid var(--z-tag-d);line-height:18px}
& .rb .rb-cv{color:var(--z-dim)}
& .rb.rb-open .rb-bd{border-top:1px solid var(--z-line);margin:0 10px;padding:12px 4px 14px}
`, ".scs");
