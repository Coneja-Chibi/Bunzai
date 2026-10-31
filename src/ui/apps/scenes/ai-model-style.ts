/**
 * The AI wing's Model tab, copied from RoleCall's ModelSelector.tsx:425-856 (Tailwind converted to values): the action row with its close button, the search
 * (p-4, border-b), the provider pills (text-xs, rounded, with the sticky dashed Connect Provider first), and the list of group heads, the Currently Selected
 * card, Favorites and the model rows (p-4, border, pr-12, the star shown on hover). These rules come after scene-turn-style.ts in the sheet and replace its
 * `.ms-*`, `.pill*`, `.grp-hd*` and `.mrow*` rules there; the booth's dropdown shares `.grp-hd` and sets its own heads under `.bth-grp`.
 * The wing is 720 wide (scene-turn-style.ts); the Model tab pills use the deck tones only for their glyph, as RoleCall tints the brand icon.
 */
export const AI_MODEL_STYLE = `
.scs .wbody.ms{--w-soft:color-mix(in srgb,var(--w) 12%,transparent);line-height:1.5;font-family:var(--font-ui)}
.scs .ms-close{display:flex;justify-content:flex-end;padding:8px 16px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--rc-zinc-950) 40%,transparent)}
.scs .ms-sec{padding:16px;border-bottom:1px solid var(--rc-zinc-800)}
.scs .ms-search svg{left:12px;color:var(--rc-zinc-500)}
.scs .ms-search input{box-sizing:border-box;width:100%;padding:8px 16px 8px 40px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius);background:var(--rc-zinc-800);font:var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--stage-card);outline:0;transition:border-color .15s}
.scs .ms-search input::placeholder{color:var(--rc-zinc-500)}
.scs .pills{gap:8px;padding-bottom:0}
.scs .mwrap>[aria-pressed]{opacity:0;transition:opacity .15s}
.scs .mwrap:hover>[aria-pressed],.scs .mwrap>[aria-pressed]:focus-visible,.scs .mwrap>[aria-pressed="true"]{opacity:1}
.scs .mwrap>[aria-pressed="true"]{color:var(--stage-warn)}
.scs .ms-list{padding:16px}
.scs .ms-list>.in{position:relative}
.scs .ms-list .mvr{position:absolute;top:0;left:0;width:100%;box-sizing:border-box;padding-bottom:8px}
.scs .mwrap{display:flex;align-items:center;gap:8px}
.scs .mwrap>[data-control="row"]{flex:1;min-width:0}
.scs .mwrap>[aria-pressed]{flex-shrink:0}
.scs .grp-hd{display:flex;align-items:center;gap:8px;margin-bottom:12px;font:600 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-400)}
.scs .grp-hd .rule{flex:1;height:1px;background:var(--rc-zinc-800)}
.scs .grp-hd.sel{color:var(--w)}.scs .grp-hd.sel .rule{background:color-mix(in srgb,var(--w) 30%,transparent)}
.scs .grp-hd.fav{color:var(--stage-warn)}.scs .grp-hd.fav .rule{background:color-mix(in srgb,var(--stage-warn) 20%,transparent)}
.scs .grp-hd.fav svg{fill:var(--stage-warn)}
.scs .mrow.na{padding:16px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius);background:var(--rc-zinc-950);cursor:not-allowed}
.scs .mrow .t,.scs .ms-list .mrow .t{display:flex;align-items:center;gap:8px;margin-bottom:4px;font:500 1rem/1.5rem var(--font-ui);color:var(--stage-card)}
.scs .mrow.na .t{color:var(--rc-zinc-600)}
.scs .mrow .sub,.scs .ms-list .mrow .sub{margin-top:0;font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-500)}
.scs .mwrap .chip{padding:2px 8px;border:0;border-radius:var(--rc-radius);background:color-mix(in srgb,var(--rc-zinc-800) 80%,transparent);font:500 var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-400)}
.scs .mrow .why{margin-top:6px;font-size:var(--rc-text-xs);color:var(--stage-warn)}
.scs .ms-note{padding:8px 12px;border-left:4px solid var(--stage-warn);background:color-mix(in srgb,var(--stage-warn) 10%,transparent);font:var(--rc-text-wing)/1.5 var(--font-ui);color:var(--stage-card)}
.scs .ms-none{padding:48px 0;text-align:center;font-size:var(--rc-text-sm);color:var(--rc-zinc-500)}
.scs .ms-empty{margin:32px 16px;padding:24px;text-align:center;border:1px dashed var(--rc-zinc-700);border-radius:var(--rc-radius-sm);font:var(--rc-text-sm)/1.625 var(--font-ui);color:var(--rc-zinc-400)}
.scs .ms-empty b{display:block;margin-bottom:6px;font-size:1rem;color:var(--stage-card)}
.scs .loading{display:flex;align-items:center;gap:8px;font-size:var(--rc-text-sm);color:var(--rc-zinc-400)}
`;
