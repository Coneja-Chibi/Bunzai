/** The Spellbook panel, measured from RoleCall's classes (SpellbookWingPanel.tsx): the MP pool, the mastery bar, the cast box and its feedback, the edit form, the detail rows and the cast history. Flat fills and square ends; every colour a theme token. */
export const SPELLBOOK_STYLE = `
.scs .it-card.observed{opacity:.7}
.scs .it-card.theory{border-style:dashed}
.scs .sp-pool{display:flex;flex-direction:column;gap:6px;padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--w) 10%,transparent);background:color-mix(in srgb,var(--stage-black) 20%,transparent)}
.scs .sp-pool>div{display:flex;align-items:center;gap:8px}
.scs .sp-pool .st-track{flex:1}
.scs .sp-pool small{min-width:45px;text-align:right;font:400 var(--rc-text-xs)/1.4 var(--font-mono);color:var(--stage-mute)}
.scs .sp-pending{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--w) 20%,transparent);background:color-mix(in srgb,var(--w) 10%,transparent);color:var(--stage-soft);font:400 var(--rc-text-xs)/1.4 var(--font-body)}
.scs .sp-pending span{display:inline-flex;align-items:center;gap:6px}
.scs .sp-mastery{display:flex;flex-direction:column;gap:4px}
.scs .sp-mastery>div:first-child{display:flex;justify-content:space-between;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .sp-cast{display:flex;flex-direction:column;gap:8px;width:100%}
.scs .sp-cast input{width:100%;padding:4px 8px;border:1px solid var(--stage-line);background:var(--stage-panel);color:var(--stage-soft);font:400 var(--rc-text-sm)/1.4 var(--font-body);border-radius:var(--rc-radius)}
.scs .sp-feedback{padding:8px;border:1px solid;font:500 var(--rc-text-xs)/1.4 var(--font-body);border-radius:var(--rc-radius-sm)}
.scs .sp-feedback.ok{border-color:color-mix(in srgb,var(--stage-ok) 30%,transparent);background:color-mix(in srgb,var(--stage-ok) 20%,transparent);color:var(--stage-ok)}
.scs .sp-feedback.bad{border-color:var(--stage-danger-edge);background:var(--stage-danger-bg);color:var(--stage-danger-text)}
.scs .it-fields{display:flex;flex-direction:column;gap:8px}
.scs .sp-field{display:flex;flex-direction:column;gap:4px}
.scs .sp-field span{font:500 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .sp-field textarea{min-height:60px;resize:vertical}
.scs .sp-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.scs .sp-fields{display:flex;flex-direction:column;gap:8px}
.scs .sp-row{display:flex;align-items:flex-start;gap:8px}
.scs .sp-row small{display:block;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .sp-row div{font:400 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-soft)}
.scs .sp-row ul{margin:0;padding-left:16px;font-size:var(--rc-text-xs)}
.scs .sp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .sp-grid .wide{grid-column:span 2}
.scs .sp-hist{display:flex;flex-direction:column;gap:4px;margin-top:8px}
.scs .sp-hist>div{display:flex;gap:8px;padding-left:4px;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .sp-hist span:first-child{min-width:60px;color:var(--stage-line)}
.scs .sp-hist b{margin-left:auto;color:var(--stage-var);font-weight:400}
`;
