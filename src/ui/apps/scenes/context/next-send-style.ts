/**
 * Next send's styles (.ns), copied from PromptPreviewPanel.tsx's Tailwind classes into px (px-6 py-4 24/16, px-4 py-3 16/12, p-3 12, space-y-3 12, text-xs 12, h-9 36, px-3 py-1.5
 * 12/6, px-3 py-1.5 role header). RoleCall's 10 to 11px text is raised to the 12px floor and its violet / cyan / pink role colours map to stage tokens; corners are square.
 */
export const NEXT_SEND_STYLE = `
.scs .ns{display:flex;flex-direction:column;min-height:100%;font-family:var(--font-ui);color:var(--stage-soft);background:var(--stage-floor)}
.scs .ns-hd{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 24px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .ns-hd p{margin:0;font:400 var(--text-meta) var(--font-ui);color:var(--stage-soft)}
.scs .ns-hd>div{display:flex;align-items:center;gap:8px}
.scs .ns-upd{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border:1px solid color-mix(in srgb,var(--stage-var) 20%,transparent);background:color-mix(in srgb,var(--stage-var) 10%,transparent);font:var(--text-meta) var(--font-ui);color:var(--stage-var)}
.scs .ns-copy{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid color-mix(in srgb,var(--stage-var) 30%,transparent);background:color-mix(in srgb,var(--stage-var) 20%,transparent);font:500 var(--text-meta) var(--font-ui);color:var(--stage-var);cursor:pointer}
.scs .ns-copy:disabled{border-color:transparent;background:var(--stage-sunken);color:var(--stage-dim);cursor:not-allowed}
.scs .ns-search{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-sunken) 40%,transparent);color:var(--stage-dim)}
.scs .ns-search input{flex:1;height:36px;padding:0 36px 0 12px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-sunken) 80%,transparent);font:var(--text-meta) var(--font-ui);color:var(--stage-card)}
.scs .ns-search input::placeholder{color:var(--stage-dim)}
.scs .ns-search button{position:absolute;right:24px;display:grid;place-items:center;width:20px;height:20px;padding:0;border:0;background:none;color:var(--stage-dim);cursor:pointer}
.scs .ns-search small{flex-basis:100%;font:var(--text-meta) var(--font-ui);color:var(--stage-dim)}
.scs .ns-body{flex:1;display:flex;flex-direction:column;gap:12px;padding:16px}
.scs .ns-empty{margin:auto;padding:48px 12px;text-align:center;color:var(--stage-dim)}
.scs .ns-empty p{margin:16px 0 4px;font:var(--text-control) var(--font-ui);color:var(--stage-mute)}
.scs .ns-empty small{font:var(--text-meta) var(--font-ui);color:var(--stage-dim)}
.scs .ns-empty.err{color:var(--stage-danger-text)}.scs .ns-empty.err p{font-weight:500;color:var(--stage-danger-text)}
.scs .ns-msg{border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-panel) 50%,transparent)}
.scs .ns-msg>div{display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--rc);background:color-mix(in srgb,var(--rc) 10%,transparent);font:600 var(--text-meta) var(--font-ui);letter-spacing:.08em;text-transform:uppercase;color:var(--rc)}
.scs .ns-msg>div i{width:8px;height:8px;border-radius:50%;background:currentColor}
.scs .ns-msg>div span{margin-left:auto;font-weight:400;letter-spacing:0;text-transform:none;opacity:.6}
.scs .ns-msg.system{--rc:var(--stage-macro)}.scs .ns-msg.user{--rc:var(--stage-var)}.scs .ns-msg.assistant{--rc:var(--deck-persona)}
.scs .ns-msg pre{margin:0;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;font:var(--text-meta)/1.6 var(--font-mono);color:var(--stage-soft)}
.scs .ns-msg mark{padding:0 2px;background:color-mix(in srgb,var(--stage-warn) 30%,transparent);color:var(--stage-card)}
.scs .ns-foot{padding:12px 16px;border-top:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-panel) 50%,transparent)}
.scs .ns-foot p{display:flex;align-items:center;gap:8px;margin:0;font:var(--text-meta) var(--font-ui);color:var(--stage-dim)}
.scs .ns-foot p+p{margin-top:6px}
.scs .ns-foot i{flex:none;width:6px;height:6px;border-radius:50%;background:var(--stage-var)}
.scs .ns button:focus-visible,.scs .ns input:focus-visible{outline:2px solid var(--focus-ring);outline-offset:1px}
`;
