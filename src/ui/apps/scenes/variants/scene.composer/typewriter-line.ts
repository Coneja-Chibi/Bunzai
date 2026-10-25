/** scene.composer typewriter-line (Paper): a ruled line to type on, the draft in typewriter mono, Send as an underlined mark. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.composer", "typewriter-line", `
& .dockbar{background:linear-gradient(transparent,var(--stage-well) 45%)}
& .cap{max-width:40rem;padding:.4rem 0;background:none;backdrop-filter:none;box-shadow:none;border:0;border-bottom:var(--bk-frame-w) solid var(--text);border-radius:0}
& .cap textarea{font:400 1rem/1.6 var(--font-mono);color:var(--text)}
& .cap .send,& .cap .stop{background:none;border:0;border-bottom:var(--bk-frame-w) solid var(--text);color:var(--text)}
& .cap .send:disabled{color:var(--stage-dim);border-color:var(--stage-dim)}
& .cap .hint{color:var(--text)}
`, ".scs");
