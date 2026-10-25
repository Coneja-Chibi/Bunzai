/** scene.composer command-box (Encore): a bracketed input panel with a prompt mark, a slab Send. */
import { brackets, variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.composer", "command-box", `
& .cap{position:relative;max-width:62rem;padding:.7rem 1rem .7rem 2.1rem;background:var(--stage-panel);backdrop-filter:none;box-shadow:none;border:var(--bk-frame-w) solid var(--bk-line-strong);border-radius:0}
& .cap::before{content:">";position:absolute;left:.85rem;top:.72rem;font:700 1rem/1.4 var(--font-mono);color:var(--bk-role-action-text)}
& .cap::after{content:"";position:absolute;inset:4px;pointer-events:none;background:${brackets("var(--bk-line-strong)", ".6rem")}}
& .cap textarea{font:400 .9375rem/1.5 var(--font-mono);color:var(--text)}
& .cap .send{width:auto;min-width:2.5rem;background:var(--accent-deep);color:var(--bk-text-on-deep);border:0}
& .cap .send:disabled{background:var(--stage-row);color:var(--stage-dim)}
& .cap .stop{width:auto;min-width:2.5rem}
`, ".scs");
