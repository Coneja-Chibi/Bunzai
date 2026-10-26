/** scene.reasoning slab-note (GirliePop): a solid-headed slab for native reasoning, a plain outlined card for tag thinking. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.reasoning", "slab-note", `
& .rb.rb-nat{border:var(--bk-frame-w) solid var(--z-nat-d);background:var(--z-panel)}
& .rb.rb-nat [data-part="scene.reasoning.header"]{background:var(--z-nat-d);color:var(--z-ondeep)}
& .rb.rb-nat .rb-chip,& .rb.rb-nat .rb-dur,& .rb.rb-nat .rb-snip,& .rb.rb-nat .rb-cv{color:var(--z-ondeep);padding-inline:0}
& .rb.rb-nat .rb-chip{font-family:var(--z-disp);font-size:13px;letter-spacing:.04em;text-transform:none}
& .rb.rb-tag{margin-right:36px;border:1px solid var(--z-tag-d);background:var(--z-panel)}
& .rb.rb-tag .rb-chip{color:var(--z-tag-t);padding:0;font-family:var(--z-disp);font-size:13px;letter-spacing:.04em;text-transform:none}
& .rb.rb-tag .rb-cv{color:var(--z-tag-t)}
& .rb.rb-open .rb-bd{padding:12px 14px 14px}
`, ".scs");
