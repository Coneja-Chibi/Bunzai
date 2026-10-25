/**
 * What the Stage look paints on the scene (stage-look-core.ts lookRoot): the Type act's size, line height, face and colours, the
 * Message act's spacing and avatars, Compact Mode, the Chat Theme, collapsed wings and their edge indicator, wing labels and the
 * streaming fade-in. Every rule is gated on a `data-look` flag or `data-chat-theme` on the scene root, and carries the same
 * specificity as a theme variant and comes after them, so a setting beats the variant and an unset one changes nothing.
 * Bubble opacity is read by the bubble paint itself (bubble-opacity.ts).
 */
const L = (flag: string): string => `html .scs[data-look~="${flag}"]`;
const T = (theme: string): string => `html .scs[data-chat-theme="${theme}"]`;

export const STAGE_LOOK_STYLE = `
${L("size")} .prose{font-size:var(--bk-msg-size)}
${L("lh")} .prose{line-height:var(--bk-msg-lh)}
${L("font")} .prose{font-family:var(--bk-msg-font)}
${L("color")} .msg:not(.user) .prose{color:var(--bk-msg-color)}
${L("color-user")} .msg.user .prose{color:var(--bk-msg-color-user)}
/* a speaker tint is an inline style on the quote, so only !important can put the chosen dialogue colour over it */
${L("dialogue")} .msg:not(.user) .prose q{color:var(--bk-msg-dialogue)!important}
${L("gap")} .msg{padding-top:var(--bk-msg-gap)}
${L("noavatar")} .msg .por{display:none}
${L("noavatar")} .msg{grid-template-columns:minmax(0,1fr);padding-left:0}
${L("noavatar")} .msg.user{padding-right:0}
${L("compact")}{--bk-density:.7}
${L("nolabels")} .wi .tip{display:none}
@media (prefers-reduced-motion:no-preference){
html .scs:not([data-look~="nofade"]) .bub.live{animation:scs-fadein .35s ease-out}
}
@keyframes scs-fadein{from{opacity:0}to{opacity:1}}
${T("basic")} .rail.l,${T("basic")} .rail .wi:not([data-wing="ai"]):not([data-wing="stage"]),${T("basic")} .bgm::after,${T("basic")} [data-part="scene.hud"]{display:none}
${T("immersive")} .play::before,${T("immersive")} .play::after{content:"";position:absolute;left:0;right:0;z-index:30;height:clamp(24px,7%,72px);background:var(--stage-black);pointer-events:none}
${T("immersive")} .play::before{top:0}
${T("immersive")} .play::after{bottom:0}
@container (min-width:1024px){
${L("collapse")}:not(.paused) .rail{transition:translate .25s,opacity .2s}
${L("collapse")}:not(.paused) .rail.l{translate:calc(-100% + 6px)}
${L("collapse")}:not(.paused) .rail.r{translate:calc(100% - 6px)}
${L("collapse")}:not(.paused) .rail:is(:hover,:focus-within){translate:0}
${L("collapse")} .rail::after{width:3px}
${L("segmented")} .rail::after{width:4px;box-shadow:none}
${L("segmented")} .rail.l::after{background:linear-gradient(to bottom,var(--accent) 0 20%,var(--deck-character) 20% 40%,var(--deck-preset) 40% 60%,var(--deck-lorebook) 60% 80%,var(--deck-regex) 80% 100%)}
${L("segmented")} .rail.r::after{background:linear-gradient(to bottom,var(--stage-var) 0 33.4%,var(--stage-macro) 33.4% 66.7%,var(--stage-warn) 66.7% 100%)}
}
`;
