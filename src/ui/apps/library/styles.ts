/**
 * Library app chrome CSS (injected <style> string): the Premiere look for the toolbar, groups bar, send bar, notices
 * and dialogs. Kept out of index so the app stays under the line cap; views/registry appends deck-view CSS at runtime.
 * Surfaces and ink come from theme tokens; gold trim is --premiere-gold, the glass is the Panel's own tint.
 */
import { icSvg } from "../../_shared/ic-svg";

export const MARK_SVG = icSvg("lucide:book-open", 18);

export const PREF_VIEW = "library.view";
export const PREF_SIZE = "library.size";
export const PREF_FIRST_DECK = "firstDeck"; // written by the setup wizard; the shelves open on it

export const LIBRARY_STYLE = `
/* the room's shared surfaces; the dialogs render outside .lib, so they carry them too */
.lib,.impsheet,.delsheet,.wkspsheet{--glass:color-mix(in srgb,var(--bk-role-select) 5%,var(--bk-surface-panel));
  --glass-deep:color-mix(in srgb,var(--bk-role-select) 3%,var(--bk-surface-sunken));--hair:color-mix(in srgb,var(--text) 14%,transparent);
  --gold-line:color-mix(in srgb,var(--premiere-gold) 40%,transparent);--glow:0 18px 60px color-mix(in srgb,var(--bk-role-select) 35%,transparent)}
.lib{container-type:inline-size;display:flex;flex-direction:column;gap:.7rem;padding:clamp(.7rem,1.8vw,1.1rem);min-height:100%;font-family:var(--font-ui)}
/* gold UI-font kickers and field labels, shared */
.mkick,.impkick,.nomatch .nmk,.sk{font:600 var(--text-meta)/1 var(--font-ui);letter-spacing:.2em;text-transform:uppercase;color:var(--premiere-gold)}
/* a staged moment: the first landing, the unreachable studio and the no-match notice */
.lib .moment{margin:6vh auto 0;max-width:35rem;display:flex;flex-direction:column;align-items:center;gap:.75rem;padding:2rem;text-align:center}
.lib .moment.wide{max-width:59rem}
.lib .stagezone{flex:1;display:flex;flex-wrap:wrap;gap:var(--gap-l);align-items:center;justify-content:center;padding:var(--gap-l)}
.lib .stagezone>[data-control="card"]{width:clamp(11rem,22vw,16rem);align-items:center;justify-content:center;text-align:center}
.voice{margin:0;font:700 1.625rem/1.2 var(--font-fancy);color:var(--text);text-align:center;text-shadow:0 2px 30px color-mix(in srgb,var(--bk-role-select) 40%,transparent)}
.lib .damage-note{display:grid;grid-template-columns:1fr auto;gap:.25rem 1rem;align-items:center;flex:none;padding:.875rem 1.125rem;
  border-left:5px solid var(--stage-danger-edge);background:color-mix(in srgb,var(--stage-danger-edge) 10%,var(--glass-deep))}
.damage-note strong{font:700 1rem var(--font-fancy);letter-spacing:.02em}
.damage-note p,.damage-note details{grid-column:1/-1;margin:0;font-size:.8125rem;color:var(--text-dim)}
.damage-note summary{cursor:pointer;color:var(--premiere-gold);margin-top:.25rem}
.damage-note .dn-list{margin:.5rem 0 0 1.125rem}
.damage-note .dn-row{display:list-item;list-style:disc;padding:.25rem 0;font-size:.8125rem}
.damage-note code{overflow-wrap:anywhere;font-size:var(--text-meta);color:var(--text)}

/* the dialogs (InkDialog owns overlay/sheet chrome): one sheet, gold top edge, hard shadow, gold hairline above the buttons */
.impsheet,.delsheet,.wkspsheet{padding:1.5rem 1.75rem;background:color-mix(in srgb,var(--bk-role-select) 6%,var(--bk-surface-panel));
  border:3px solid var(--stage-black);border-top-color:var(--premiere-gold);box-shadow:6px 6px 0 var(--stage-black),var(--glow)}
.impsheet{width:min(94vw,44rem);max-width:min(94vw,44rem)}
/* the split and merge workshops hold two entry lists side by side: InkDialog's reading width cut them off mid-list */
.wkspsheet{width:min(94vw,56rem);max-width:min(94vw,56rem)}
.delsheet{max-width:32rem}
.impkick{margin:0 0 .4rem}
.imptitle,.delsheet .deltitle{display:block;margin:0 0 .5rem;font:700 1.5rem/1.15 var(--font-fancy);color:var(--text);text-shadow:0 2px 30px color-mix(in srgb,var(--bk-role-select) 40%,transparent)}
.impsub,.impprog,.delsheet .delbody{margin:0 0 .875rem;font:.875rem/1.55 var(--font-ui);color:var(--text-dim)}
.improws{display:flex;flex-direction:column;gap:.25rem;max-height:50dvh;overflow:auto;margin:0 0 1rem;padding:.25rem .375rem .25rem 0}
/* a row is open: one deck-colored edge and a hairline, a tint when picked */
.improw{position:relative;display:flex;gap:.875rem;align-items:center;padding:.625rem .875rem;cursor:pointer;
  border-left:4px solid var(--a,var(--accent));border-bottom:1px solid var(--hair);transition:background .2s ease,transform .2s ease}
.improw:hover{transform:translateX(4px);background:color-mix(in srgb,var(--a,var(--accent)) 10%,transparent)}
.improw.on{background:color-mix(in srgb,var(--a,var(--accent)) 14%,transparent)}
.improw.bad{--a:var(--stage-danger-edge);cursor:default}
.improw.dupe{cursor:default;opacity:.85}
.improw.bad:hover,.improw.dupe:hover{transform:none;background:none}
.improw input{position:absolute;opacity:0;width:1px;height:1px}
.impcheck{flex:none;width:1.375rem;height:1.375rem;border:2px solid color-mix(in srgb,var(--text) 45%,transparent);background:var(--stage-black);position:relative}
.improw input:checked + .impcheck{background:var(--premiere-gold);border-color:var(--premiere-gold)}
.improw input:checked + .impcheck::after{content:"";position:absolute;left:.3rem;top:.05rem;width:.3rem;height:.6rem;border:solid var(--stage-ink);border-width:0 2px 2px 0;transform:rotate(45deg)}
.improw input:focus-visible + .impcheck{outline:2px solid var(--premiere-gold);outline-offset:2px}
.impbody{min-width:0;flex:1}
.impname{display:block;font:600 .9375rem/1.25 var(--font-ui);color:var(--text);overflow-wrap:anywhere}
.impkind{font:.875rem var(--font-ui);color:var(--text);margin:.15rem 0 0}
.impmeta{font:var(--text-meta) var(--font-ui);color:var(--text-faint);margin:.25rem 0 0}
.impflag{display:inline-block;margin:0 0 .25rem;padding:.125rem .625rem;font:600 var(--text-meta) var(--font-ui);border:1px solid var(--premiere-gold);color:var(--premiere-gold)}
.improw.bad .impflag{border-color:var(--stage-danger-edge);color:var(--stage-danger-text)}
.imperr{font:.8125rem var(--font-ui);color:var(--stage-danger-text);margin:.1rem 0 0;overflow-wrap:anywhere}
/* progress marker: bordered track, accent fill; the fill is a mark, no text */
.impbar{display:block;height:.625rem;border:2px solid var(--stage-black);background:color-mix(in srgb,var(--text) 12%,transparent);position:relative;margin:0 0 .5rem}
.impbar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,var(--accent),var(--bk-role-select));transition:width .15s ease}
/* archive report: informational, never checkable, one gold edge */
.impreport{padding:.25rem 0 .25rem .875rem;border-left:4px solid var(--premiere-gold)}
.impreport .impname{margin:0 0 .3rem}
.impreport ul{margin:.35rem 0 0;padding-left:1.15rem}
.impreport li{font:.875rem var(--font-ui);color:var(--text-dim);margin:.15rem 0;overflow-wrap:anywhere}
.impacts,.delsheet .delacts{display:flex;gap:.625rem;flex-wrap:wrap;justify-content:flex-end;margin-top:.375rem;padding-top:.75rem;border-top:1px solid var(--gold-line)}
.delsheet .renamein{width:100%;min-height:2.75rem;margin:0 0 .875rem;padding:0 .875rem;font:1rem var(--font-ui);color:var(--text);
  background:color-mix(in srgb,var(--stage-black) 70%,transparent);border:2px solid color-mix(in srgb,var(--text) 25%,transparent);outline:none;transition:border-color .2s ease,box-shadow .2s ease}
.delsheet .renamein:focus{border-color:var(--premiere-gold);box-shadow:0 0 24px color-mix(in srgb,var(--premiere-gold) 22%,transparent)}

/* the staging action bar: appears only when pieces are picked */
.sendbar{display:flex;align-items:center;gap:.625rem;flex:none;flex-wrap:wrap;padding:.625rem .875rem;background:color-mix(in srgb,var(--accent) 12%,var(--glass-deep));
  border:3px solid var(--stage-black);border-left:5px solid var(--accent);box-shadow:4px 4px 0 var(--stage-black)}
.sendbar .cnt{font:600 .875rem var(--font-ui);color:var(--text);padding-right:.5rem}
.sendbar .cnt b{font:700 1rem var(--font-mono);color:var(--premiere-gold);margin-right:.375rem}
.viewseg{flex:none}
.viewseg svg{display:block}
.sizedial{display:flex;align-items:center;gap:.75rem;flex:none;padding:0 1rem;background:var(--glass);border:3px solid var(--stage-black);box-shadow:4px 4px 0 var(--stage-black)}
.sizedial input{width:clamp(5rem,9vw,8rem)}
/* the search box: a glass field with a gold label and gold focus. NEVER GROWS past its basis: the toolbar's other
   controls own the leftover width. It still shrinks, so a narrow window squeezes the box rather than hiding one. */
.findwrap{position:relative;display:flex;flex-direction:column;flex:0 1 18rem;min-width:0}
.findbox{display:flex;align-items:center;gap:.75rem;min-height:3rem;padding:0 .75rem 0 .875rem;background:var(--glass);border:3px solid var(--stage-black);
  box-shadow:4px 4px 0 var(--stage-black);transition:border-color .2s ease,box-shadow .2s ease}
/* a live search stamps in the house accent: the one glance that says the shelf is filtered */
.findwrap.on .findbox{box-shadow:4px 4px 0 var(--accent)}
.findbox:focus-within{border-color:var(--premiere-gold);box-shadow:4px 4px 0 var(--stage-black),0 0 28px color-mix(in srgb,var(--premiere-gold) 25%,transparent)}
.findbox .sk{flex:none}
.findbox input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--text);font:.9375rem var(--font-ui);padding:.15rem 0}
.findbox input::placeholder{color:var(--text-faint);opacity:1}
/* HANGS OFF THE FIELD rather than sitting in the toolbar's flow. In flow it grew the bar by three
   lines the moment a typo appeared, shoving every control down mid-keystroke. */
.findnote{position:absolute;top:calc(100% + .25rem);left:0;right:0;z-index:2;background:var(--glass-deep);border:1px solid var(--hair);padding:.4rem .6rem;margin:0;
  font:.8125rem/1.5 var(--font-ui);color:var(--text-dim);overflow-wrap:anywhere}
/* the filtered-to-nothing shelf, deliberately NOT the ghost card. The ghost invites a first
   import, which is the wrong answer (and a small lie) when the pieces are already here and merely
   hidden by what somebody typed. A staged moment in its own panel. */
.lib .nomatch{margin:2rem auto 0;max-width:35rem;display:flex;flex-direction:column;align-items:center;gap:.75rem;padding:2rem;text-align:center}
.nomatch .nmhead{font:700 1.625rem/1.2 var(--font-fancy);color:var(--text)}
.nomatch .nmbody{font:.9375rem/1.55 var(--font-ui);color:var(--text-dim);margin:0}
.nomatch .nmq{font:.875rem var(--font-mono);color:var(--premiere-gold);overflow-wrap:anywhere}
.nomatch .nmjumps{display:flex;align-items:center;justify-content:center;gap:.5rem;flex-wrap:wrap}
/* THE PERSON'S OWN GROUPINGS: a glass strip with a gold edge, quieter than the deck rows. Browsing a group is a search. */
.colbar{display:flex;align-items:center;gap:.75rem;flex-wrap:nowrap;flex:none;min-width:0;padding:.625rem .875rem;background:var(--glass-deep);
  border:1px solid var(--hair);border-left:3px solid var(--premiere-gold)}
.colbar-list{flex:1;min-width:0;height:2.4rem;overflow-x:auto;overflow-y:hidden}
.colbar-space{position:relative;height:100%}
.colbar-item{position:absolute;left:0;top:0;height:100%}
.colbar>.sk{flex:none}
.colchip{display:flex;align-items:center;gap:.25rem;flex:none}
.colcount{font:600 var(--text-meta) var(--font-mono);color:var(--premiere-gold);margin-left:.375rem}
.colnew{flex:none;width:9rem;min-height:2rem;padding:0 .625rem;font:.875rem var(--font-ui);color:var(--text);outline:none;
  background:color-mix(in srgb,var(--stage-black) 70%,transparent);border:2px solid var(--premiere-gold)}
/* the bar says what happened, because the mono status bar cannot: see collections-ops.ts on say */
.colnote{display:flex;align-items:center;gap:.5rem;flex:none;font:.8125rem var(--font-ui);color:var(--text-dim)}
.libstage{position:relative;flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column}
/* an empty deck: a dashed deck-colored plate with its New button */
.ghost-shelf{margin:.5rem auto;max-width:36rem;padding:1.625rem;display:flex;flex-direction:column;align-items:center;gap:.875rem;text-align:center;
  border:3px dashed color-mix(in srgb,var(--a,var(--accent)) 45%,transparent);background:color-mix(in srgb,var(--a,var(--accent)) 4%,transparent);
  font:.9375rem/1.5 var(--font-ui);color:var(--text-dim)}
/* scrollbars wear the house ink, never the OS chrome */
.lib *{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--bk-role-select) 50%,transparent) transparent}
.lib *::-webkit-scrollbar{width:8px;height:8px}
.lib *::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--bk-role-select) 50%,transparent)}
.lib *::-webkit-scrollbar-track{background:transparent}
/* phones: the find box takes its own row, the view seg gets its row, the dial a full row so the thumb never clips (fluid law) */
@container (max-width: 40rem){
  .lib{padding:.5rem;gap:.5rem}
  .findwrap{order:0;flex:1 1 100%}
  .viewseg{order:2}
  .sizedial{order:3;flex:1 1 100%;min-width:0}
  .sizedial input{flex:1;width:auto;min-width:0}
  .lib .stagezone{gap:var(--gap-m);padding:var(--gap-m)}
  .lib .stagezone>[data-control="card"]{width:clamp(9rem,42vw,12rem)}
}
`;
