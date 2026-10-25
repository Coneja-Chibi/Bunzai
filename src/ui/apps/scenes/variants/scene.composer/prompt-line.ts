/** scene.composer prompt-line (Theater): an open line between two gold rules, the draft in the body face. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.composer", "prompt-line", `
& .dockbar{background:linear-gradient(transparent,var(--stage-well) 40%)}
& .cap{max-width:46rem;padding:.55rem .25rem;background:var(--stage-well);backdrop-filter:none;box-shadow:none;border:0;border-top:var(--bk-frame-w) solid var(--bk-line-strong);border-bottom:var(--bk-frame-w) solid var(--bk-line-strong);border-radius:0}
& .cap textarea{font:400 1.0625rem/1.5 var(--font-body)}
& .cap .send,& .cap .stop{background:none;border:var(--bk-frame-w) solid var(--bk-line-strong);color:var(--text)}
& .cap .send:disabled{color:var(--stage-dim)}
`, ".scs");
