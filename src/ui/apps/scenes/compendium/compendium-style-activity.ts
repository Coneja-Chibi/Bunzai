/**
 * The Activity feed and Reconcile (RoleCall `LorebookActivityFeed.tsx`, rc-world-comp-activity.png; `RelationshipReconcileModal`).
 * Sizes follow RoleCall exactly; colours are theme tokens (the amber is the scene accent `--wa`, the rose the danger
 * role). The feed answers to its pane (`@container`). The Reconcile sheet is portaled to the body by InkDialog, so its rules are not
 * scoped under `.scs`; they name only global tokens.
 */
export const COMPENDIUM_ACTIVITY_STYLE = `
.scs .cp-feed{--wa:var(--bk-scene-accent-text,var(--bk-role-brand-text));--cp-text:var(--stage-card);--cp-soft:var(--stage-soft);--cp-mute:var(--stage-mute);--cp-info:var(--bk-role-info-text);--cp-rule:color-mix(in srgb,var(--stage-card) 10%,transparent);display:flex;flex-direction:column;min-height:420px}
.scs .cp-feed .bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--cp-rule)}
.scs .cp-feed .seg{display:flex;gap:8px}
.scs .cp-feed .acts{display:flex;align-items:center;gap:4px}
.scs .cp-feed .seg button{padding:4px 12px;border:2px solid var(--stage-black);background:var(--stage-panel);color:var(--cp-soft);font:700 10px var(--font-fancy);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.scs .cp-feed .seg button.on{background:var(--wa);color:var(--stage-ink)}
.scs .cp-feed .ib{display:grid;place-items:center;width:28px;height:28px;border:0;background:none;color:var(--cp-mute);cursor:pointer}
.scs .cp-feed .ib:hover:not(:disabled){color:var(--wa)}
.scs .cp-feed .ib:disabled{opacity:.4;cursor:default}
.scs .cp-feed .empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:72px 16px;text-align:center}
.scs .cp-feed .empty .ring{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;border:1px solid var(--cp-rule);background:var(--stage-sunken);color:var(--cp-mute)}
.scs .cp-feed .empty b{font:500 14px var(--font-ui);color:var(--cp-soft)}
.scs .cp-feed .empty small{max-width:16em;font-size:12px;color:var(--cp-mute)}
.scs .cp-feed .list{display:flex;flex-direction:column;gap:8px;padding:12px 16px}
.scs .cp-act{--ph:var(--wa);display:flex;align-items:flex-start;gap:12px;padding:12px;border:2px solid var(--stage-black);border-left:6px solid var(--ph);background:var(--stage-panel)}
.scs .cp-act .bd{flex:1;min-width:0}
.scs .cp-act.pre{--ph:var(--cp-info)}
.scs .cp-act.live{--ph:var(--wa)}
.scs .cp-act.post{--ph:var(--bk-role-ok-text)}
.scs .cp-act.hist{--ph:var(--bk-role-select-text,var(--wa))}
.scs .cp-act.bad{--ph:var(--bk-role-danger-text)}
.scs .cp-act .top{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.scs .cp-act .ico{flex:none;width:28px;height:28px;margin-top:2px;display:grid;place-items:center;border-radius:var(--rc-radius-full);background:color-mix(in srgb,var(--ph) 20%,transparent);color:var(--ph)}
.scs .cp-act.bad .ico{color:var(--bk-role-danger-text)}
.scs .cp-act .lab{font:900 12px var(--font-ui);letter-spacing:.025em;text-transform:uppercase;color:var(--ph)}
.scs .cp-act .when{margin-left:auto;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--cp-mute)}
.scs .cp-act .chip{padding:2px 8px;border:1px solid var(--stage-line);font:700 11px var(--font-ui);color:var(--cp-soft)}
.scs .cp-act .chip.phase{border-color:color-mix(in srgb,var(--ph) 45%,transparent);color:var(--ph);padding:2px 6px;font:900 10px var(--font-ui);letter-spacing:.05em;text-transform:uppercase}
.scs .cp-act .chip.trig{border-color:color-mix(in srgb,var(--cp-info) 45%,transparent);background:color-mix(in srgb,var(--cp-info) 10%,transparent);color:var(--cp-text);text-transform:uppercase}
.scs .cp-act .chip.tok{font-family:var(--font-mono)}
.scs .cp-act .chip.err{border-color:var(--bk-role-danger-text);color:var(--bk-role-danger-text);text-transform:uppercase;padding:2px 6px;font-weight:900;font-size:10px}
.scs .cp-act .chip.ent{border-color:color-mix(in srgb,var(--tc,var(--wa)) 55%,transparent);background:color-mix(in srgb,var(--tc,var(--wa)) 10%,transparent);color:var(--cp-text)}
.scs .cp-act .chip small{color:var(--cp-mute)}
.scs .cp-act .txt{margin:6px 0 0;font-size:13px;line-height:1.375;color:var(--cp-text)}
.scs .cp-act .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.scs .cp-act .foot{display:flex;align-items:center;gap:12px;margin-top:8px}
.scs .cp-act .lnk,.scs .cp-act .act{padding:0;border:0;background:none;color:var(--wa);font:900 12px var(--font-ui);cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.scs .cp-act .act:disabled{opacity:.5;cursor:default}
.scs .cp-act .det{margin-top:8px;padding-top:8px;border-top:1px solid var(--cp-rule);font-size:12px;color:var(--cp-soft)}
.scs .cp-act .det .why{margin-top:4px;color:var(--cp-mute)}
.scs .cp-act .det.reason{border-left:2px solid var(--cp-info);padding-left:12px;color:var(--cp-text)}
.cp-rec-btn{padding:6px 12px;border:2px solid var(--bk-role-danger-text);background:none;color:var(--bk-role-danger-text);font:700 11px var(--font-fancy);letter-spacing:.15em;text-transform:uppercase;cursor:pointer}
.cp-rec-btn:hover{background:color-mix(in srgb,var(--bk-role-danger-text) 12%,transparent)}
.cp-rec.cp-rec{max-width:900px;max-height:calc(100vh - 2rem);display:flex;flex-direction:column;padding:0}
.cp-rec header{padding:16px 20px;border-bottom:1px solid var(--bk-line-control)}
.cp-rec h3{margin:0;font:700 14px var(--font-fancy);letter-spacing:.15em;text-transform:uppercase}
.cp-rec header b{display:block;margin-top:6px;font-size:14px;color:var(--bk-role-danger-text)}
.cp-rec header p{margin:8px 0;font-size:14px;color:var(--bk-text-soft)}
.cp-rec button{padding:4px 10px;border:1px solid var(--bk-line-control);background:var(--bk-surface-sunken);color:var(--bk-text);font:700 11px var(--font-ui);letter-spacing:.05em;text-transform:uppercase;cursor:pointer}
.cp-rec button:disabled{opacity:.5;cursor:default}
.cp-rec button.go{border-color:var(--bk-role-brand-text);color:var(--bk-role-brand-text)}
.cp-rec .note{padding:8px 20px;font-size:14px;color:var(--bk-role-danger-text)}
.cp-rec .body{flex:1;overflow-y:auto;padding:8px 20px}
.cp-rec .gh{display:flex;align-items:center;gap:8px;padding:12px 0 6px}
.cp-rec .gh button{margin-left:auto}
.cp-rec .gh small{color:var(--bk-text-dim)}
.cp-rec .row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:6px 0;border-top:1px solid var(--bk-line-track);font-size:14px}
.cp-rec .acts{display:flex;align-items:center;gap:6px}
.cp-rec em{font:700 11px var(--font-ui);font-style:normal;letter-spacing:.05em;text-transform:uppercase}
.cp-rec em.done{color:var(--bk-role-ok-text)}
.cp-rec em.bad{color:var(--bk-role-danger-text)}
.cp-rec footer{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-top:1px solid var(--bk-line-control)}
`;
