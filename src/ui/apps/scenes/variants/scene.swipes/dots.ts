/** scene.swipes dots (GirliePop): one square pip per version between the arrows; the count stays as a sticker. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.swipes", "dots", `
& .swc{gap:.35rem;padding:.2rem .45rem;background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);backdrop-filter:none;box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--bk-line-strong)}
& .vdots{display:inline-flex;gap:.3rem;align-items:center}
& .vdots button{width:.75rem;height:.75rem;padding:0;border:var(--bk-frame-w) solid var(--bk-line-strong);background:var(--stage-row);border-radius:0;cursor:pointer}
& .vdots button.on{background:var(--tone)}
& .vdots button:disabled{cursor:default;opacity:.6}
`, ".scs");
