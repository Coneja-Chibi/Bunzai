/** scene.composer chat-input (GirliePop): a thick slab bar with a stamp shadow and a big Send. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.composer", "chat-input", `
& .cap{max-width:44rem;padding:.55rem .55rem .55rem 1rem;background:var(--stage-panel);backdrop-filter:none;border:var(--bk-frame-w) solid var(--bk-line-strong);border-radius:0;box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--bk-line-strong)}
& .cap textarea{font:400 1.0625rem/1.4 var(--font-body);color:var(--text)}
& .cap .send,& .cap .stop{width:2.75rem;height:2.75rem;border:var(--bk-frame-w) solid var(--bk-line-strong)}
& .cap .send{background:var(--action-primary);color:var(--action-primary-fg)}
& .cap .send:disabled{background:var(--stage-row);color:var(--stage-dim)}
`, ".scs");
