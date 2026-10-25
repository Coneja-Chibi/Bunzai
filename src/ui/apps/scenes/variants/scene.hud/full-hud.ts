/** scene.hud full-hud (Encore, design/system scene variant B): a slab header and a readout strip (take, messages, model) over the composer. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.hud", "full-hud", `
& .sh{background:var(--stage-panel);border-bottom:var(--bk-frame-w) solid var(--bk-line-strong)}
& .sh .nm{font-family:var(--font-mono);letter-spacing:.14em;font-size:.9375rem}
& .sh .branch{background:var(--stage-row);border:var(--bk-frame-w) solid var(--bk-line-strong);color:var(--text);font-family:var(--font-mono);text-transform:uppercase}
& .hudline{position:absolute;left:50%;transform:translateX(-50%);bottom:5.6rem;z-index:41;display:flex;gap:1.5rem;padding:.3rem 1rem;background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);font:600 .8125rem/1.4 var(--font-mono);color:var(--text);white-space:nowrap;max-width:calc(100% - 2rem);overflow:hidden}
& .hudline small{font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim)}
& .hudline b{font-weight:700}
`, ".scs");
