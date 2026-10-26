/**
 * Library app chrome CSS (injected <style> string). Kept out of index so the app
 * stays under the line cap; views/registry appends deck-view CSS at runtime.
 */
import { icSvg } from "../../_shared/ic-svg";

export const MARK_SVG = icSvg("lucide:book-open", 18);

export const PREF_VIEW = "library.view";
export const PREF_SIZE = "library.size";
export const PREF_FIRST_DECK = "firstDeck"; // written by the setup wizard; the shelves open on it

export const LIBRARY_STYLE = `
.lib{container-type:inline-size;display:flex;flex-direction:column;gap:.7rem;padding:clamp(.7rem,1.8vw,1.1rem);min-height:100%}
.lib .stagezone{flex:1;display:flex;flex-wrap:wrap;gap:var(--gap-l);align-items:center;justify-content:center;padding:var(--gap-l)}
.lib .stagezone>[data-control="card"]{width:clamp(11rem,22vw,16rem);align-items:center;justify-content:center;text-align:center}
.voice{font-style:italic;font-weight:600;color:var(--muted);text-align:center;font-size:1.05rem}
.damage-note{position:relative;border:3px solid var(--stage-danger-edge);box-shadow:4px 4px 0 0 var(--edge);
  background:var(--panel);color:var(--text);padding:.65rem .8rem}
.damage-note strong{display:block;font-family:var(--font-big);font-weight:900;padding-right:5rem}
.damage-note p{margin:.35rem 0 0;color:var(--text-dim);font-size:.85rem}
.damage-note details{margin-top:.45rem}
.damage-note summary{cursor:pointer;font-family:var(--font-mono);font-weight:700;font-size: var(--text-meta);
  letter-spacing:.04em;text-transform:uppercase}
.damage-note ul{margin:.55rem 0 0;padding-left:1.35rem}
.damage-note li{margin:.25rem 0;font-size:var(--text-body)}
.damage-note code{overflow-wrap:anywhere}
/* the import sheet (InkDialog owns overlay/sheet chrome; the delsheet/export-dialog grammar) */
.impsheet{padding:1.1rem 1.3rem;width:min(94vw,44rem);max-width:min(94vw,44rem)}
/* the split and merge workshops hold two entry lists side by side: InkDialog's 24rem reading width
   cut them off mid-list, so they take a wide sheet of their own */
.wkspsheet{width:min(94vw,50rem);max-width:min(94vw,50rem)}
.impkick{font-family:var(--font-mono);font-weight:700;font-size: var(--text-meta);letter-spacing:.12em;
  text-transform:uppercase;color:var(--text-dim);margin:0 0 .3rem}
.imptitle{display:block;font-family:var(--font-big);font-weight:900;font-size:1.15rem;color:var(--text);
  margin:0 0 .3rem}
.impsub{font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.04em;color:var(--text-soft);margin:0 0 .9rem}
.improws{display:flex;flex-direction:column;gap:.55rem;max-height:50dvh;overflow:auto;margin:0 0 1rem}
.improw{position:relative;display:flex;gap:.7rem;align-items:flex-start;background:var(--face);
  border:2px solid var(--edge);padding:.65rem .8rem;cursor:pointer}
.improw.on{border-color:var(--accent);box-shadow:2px 2px 0 0 var(--edge)}
.improw.bad{border-style:dashed;cursor:default}
.improw input{position:absolute;opacity:0;width:1px;height:1px}
.impcheck{flex:none;width:1.1rem;height:1.1rem;border:2px solid var(--edge);background:var(--face);
  position:relative;margin-top:.15rem}
.improw input:checked + .impcheck{background:var(--accent-deep);border-color:var(--accent)}
.improw input:checked + .impcheck::after{content:"";position:absolute;left:.28rem;top:.08rem;
  width:.3rem;height:.55rem;border:solid var(--stage-white);border-width:0 2px 2px 0;transform:rotate(45deg)}
.improw input:focus-visible + .impcheck{outline:2px solid var(--accent);outline-offset:2px}
.impbody{min-width:0}
.impname{display:block;font-family:var(--font-big);font-weight:800;font-size:1rem;color:var(--text);
  overflow-wrap:anywhere}
.impkind{font-family:var(--font-body);font-size:var(--text-control);color:var(--text);margin:.15rem 0 0}
.impmeta{font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.04em;color:var(--text-soft);margin:.25rem 0 0}
.impflag{display:inline-block;font-family:var(--font-mono);font-weight:700;font-size: var(--text-meta);letter-spacing:.08em;
  text-transform:uppercase;background:var(--rose-deep);color:var(--stage-white);padding:.12rem .4rem;margin:0 0 .25rem}
.imperr{font-family:var(--font-body);font-size:var(--text-body);color:var(--text-soft);margin:.1rem 0 0;overflow-wrap:anywhere}
/* progress marker (house bar grammar: bordered track, accent fill; the fill is a mark, no text) */
.impbar{display:block;height:.6rem;border:2px solid var(--edge);background:var(--face);
  position:relative;margin:0 0 .5rem}
.impbar i{position:absolute;left:0;top:0;bottom:0;background:var(--accent);transition:width .15s ease}
.impprog{font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.04em;color:var(--text-soft);margin:0 0 .9rem}
.improw.dupe{border-style:dotted;cursor:default;opacity:.85}
/* archive report card: informational, never checkable, so it reads on --panel (damage-note's own
   convention for "read this", not --face's "check this") rather than borrowing improw's own look. */
.impreport{background:var(--panel);border:2px solid var(--edge);padding:.65rem .8rem}
.impreport .impname{margin:0 0 .3rem}
.impreport ul{margin:.35rem 0 0;padding-left:1.15rem}
.impreport li{font-family:var(--font-body);font-size:var(--text-body);color:var(--text-soft);margin:.15rem 0;
  overflow-wrap:anywhere}
.impacts{display:flex;gap:.5rem;flex-wrap:wrap}
.wbbar{display:flex;align-items:center;gap:.6rem;flex:none;flex-wrap:wrap}
/* the staging action bar: appears only when pieces are picked (the distributed tray's commit) */
.sendbar{display:flex;align-items:center;gap:.6rem;flex:none;flex-wrap:wrap;background:var(--stamp-bg);
  border:3px solid var(--edge);box-shadow:4px 4px 0 0 var(--accent);padding:.4rem .55rem .4rem .7rem}
.sendbar .cnt{font-family:var(--font-big);font-weight:900;font-size: var(--text-control);letter-spacing:.04em;color:var(--stamp-fg)}
.delsheet{padding:1rem 1.1rem;max-width:24rem}
.delsheet .deltitle{display:block;font-family:var(--font-big);font-weight:900;font-size:.95rem;
  color:var(--text);margin:0 0 .45rem}
.delsheet .delbody{font-family:var(--font-body);font-size:var(--text-body);color:var(--text-dim);margin:0 0 .8rem;
  line-height:1.5}
.delsheet .delacts{display:flex;gap:.5rem}
.delsheet .renamein{width:100%;font-family:var(--font-body);font-size:16px;color:var(--text);
  background:var(--face);border:2px solid var(--edge);padding:.45rem .55rem;margin:0 0 .8rem}
.deckchips{display:flex;gap:.4rem;flex:1;min-width:0;overflow-x:auto;padding-bottom:2px}
.dchip{display:flex;align-items:center;gap:.45rem;flex:none;cursor:pointer;font-family:var(--font-big);
  font-weight:800;font-size: var(--text-control);letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim);
  background:var(--face);border:3px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge);padding:.35rem .55rem;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.dchip .pip{width:10px;height:10px;flex:none;border:2px solid var(--edge);background:var(--a)}
.dchip .dc{font-family:var(--font-mono);font-weight:600;font-size: var(--text-control);color:var(--text-dim)}
.dchip:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--edge)}
.dchip.on{background:var(--stamp-bg);color:var(--stamp-fg);box-shadow:3px 3px 0 0 var(--a)}
.dchip.on .dc{color:var(--stamp-fg);opacity:.7}
.viewseg{flex:none}
.viewseg svg{display:block}
.sizedial{display:flex;align-items:center;gap:.45rem;flex:none;border:3px solid var(--edge);
  box-shadow:3px 3px 0 0 var(--edge);background:var(--face);padding:.3rem .6rem}
.sizedial .sk{font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim)}
.sizedial input{width:clamp(5rem,9vw,8rem)}
/* the search box wears the size dial's chrome (bordered, stamped, mono kicker) so the deck bar
   still reads as one object rather than a toolbar with a web form bolted on */
/* NEVER GROWS. The deck chips are this room's navigation and they own the leftover width; a
   search box with flex-grow took it and pushed three of the six decks behind a scroll nobody
   could see. It still shrinks, so a narrow window squeezes the box rather than hiding a deck. */
.findwrap{position:relative;display:flex;flex-direction:column;flex:0 1 18rem;min-width:0}
.findbox{display:flex;align-items:center;gap:.45rem;border:3px solid var(--edge);
  box-shadow:3px 3px 0 0 var(--edge);background:var(--face);padding:.3rem .5rem}
/* a live search stamps in the house accent: the one glance that says the shelf is filtered */
.findwrap.on .findbox{box-shadow:3px 3px 0 0 var(--accent)}
.findbox:focus-within{outline:2px solid var(--accent);outline-offset:2px}
.findbox .sk{flex:none;font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.12em;
  text-transform:uppercase;color:var(--text-dim)}
.findbox input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--text);
  font-family:var(--font-mono);font-size: var(--text-control);padding:.15rem 0}
.findbox input::placeholder{color:var(--text-dim);opacity:1}
/* HANGS OFF THE FIELD rather than sitting in the toolbar's flow. In flow it grew the bar by three
   lines the moment a typo appeared, shoving every deck chip down mid-keystroke. */
.findnote{position:absolute;top:calc(100% + .25rem);left:0;right:0;z-index:2;background:var(--panel);
  border:2px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge);padding:.35rem .45rem;margin:0;
  font-family:var(--font-mono);font-size: var(--text-meta);line-height:1.5;color:var(--text-soft);
  overflow-wrap:anywhere}
/* a deck holding no matches RECEDES rather than vanishing: the chip still says what it holds */
.dchip.nil{opacity:.45}
/* the filtered-to-nothing shelf, deliberately NOT the ghost card. The ghost invites a first
   import, which is the wrong answer (and a small lie) when the pieces are already here and merely
   hidden by what somebody typed. */
.nomatch{margin:auto;max-width:32rem;display:flex;flex-direction:column;align-items:flex-start;
  gap:.55rem;border:2px dashed var(--stage-line);padding:1rem 1.1rem}
.nomatch .nmhead{font-family:var(--font-big);font-weight:900;font-size:var(--text-control);letter-spacing:.04em;
  text-transform:uppercase;color:var(--stage-card)}
.nomatch .nmbody{font-family:var(--font-body);font-size:var(--text-body);line-height:1.5;color:var(--stage-soft);margin:0}
.nomatch .nmq{font-family:var(--font-mono);font-size:.8rem;color:var(--stage-paper);
  background:var(--stage-sunken);border:2px solid var(--stage-seam);padding:.05rem .3rem;overflow-wrap:anywhere}
.nomatch .nmjumps{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}
.nomatch .nmk{font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.12em;text-transform:uppercase;
  color:var(--stage-kicker)}
/* THE PERSON'S OWN GROUPINGS. Quieter than the deck chips on purpose: decks are the studio's own
   shape and are always true, while a group is a private note about some of it. Same chip grammar so
   the row still reads as one toolbar, one weight down. */
.colbar{display:flex;align-items:center;gap:.4rem;flex-wrap:nowrap;flex:none;min-width:0}
.colbar-list{flex:1;min-width:0;height:2.4rem;overflow-x:auto;overflow-y:hidden}
.colbar-space{position:relative;height:100%}
.colbar-item{position:absolute;left:0;top:0;height:100%}
.colbar>.sk{flex:none;font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.12em;
  text-transform:uppercase;color:var(--text-dim)}
.colchip{display:flex;align-items:center;gap:.25rem;flex:none}
.colcount{font-family:var(--font-mono);font-weight:600;font-size: var(--text-meta);opacity:.75}
.colnew{flex:none;width:9rem;border:2px solid var(--accent);background:var(--face);color:var(--text);
  font-family:var(--font-mono);font-size: var(--text-meta);padding:.25rem .4rem;outline:none}
/* the bar says what happened, because the mono status bar cannot: see collections-ops.ts on say */
.colnote{display:flex;align-items:center;gap:.4rem;flex:none;font-family:var(--font-mono);
  font-size: var(--text-meta);color:var(--text-soft);border:2px solid var(--text-faint);padding:.25rem .45rem}
.prosc{position:relative;flex:1;min-height:0;background:var(--shell-panel-2);border:3px solid var(--edge);
  box-shadow:6px 6px 0 0 var(--edge);padding:.55rem;display:flex}
.libstage{position:relative;flex:1;min-height:0;background:var(--stage-well);border:3px solid var(--stage-black);overflow:hidden;
  box-shadow:inset 8px 8px 0 0 var(--shadow-ink-deep);display:flex;flex-direction:column}
.stage-crumb{display:flex;align-items:center;gap:.5rem;border-bottom:3px solid var(--stage-black);background:var(--stage-sunken);padding:.5rem .75rem;flex:none}
.stage-crumb .pip{width:11px;height:11px;border:2px solid var(--stage-black);background:var(--a)}
.stage-crumb .cc{font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.1em;text-transform:uppercase;color:var(--stage-mute);margin-left:auto}
.ghost-shelf{margin:auto;width:clamp(9rem,30vw,14rem);aspect-ratio:2/3;border:2px dashed var(--stage-faint);
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:.8rem;
  font-family:var(--font-mono);font-size: var(--text-meta);font-weight:600;letter-spacing:.06em;line-height:1.6;
  text-transform:uppercase;color:var(--stage-soft)}
/* scrollbars wear the house ink, never the OS chrome */
.lib *{scrollbar-width:thin;scrollbar-color:var(--stage-seam) transparent}
.lib *::-webkit-scrollbar{width:8px;height:8px}
.lib *::-webkit-scrollbar-thumb{background:var(--stage-seam)}
.lib *::-webkit-scrollbar-track{background:transparent}
.deckchips{scrollbar-width:none}
.deckchips::-webkit-scrollbar{display:none}
/* phones: chips WRAP (everything visible, nothing hidden behind an invisible scroll), the view
   seg gets its row, the dial gets a full row so the thumb never clips (fluid law) */
@container (max-width: 40rem){
  .lib{padding:.5rem;gap:.5rem}
  .wbbar{gap:.4rem}
  .findwrap{order:0;flex:1 1 100%}
  .deckchips{flex:1 1 100%;order:1;flex-wrap:wrap;overflow:visible;padding-bottom:0}
  .viewseg{order:2}
  .sizedial{order:3;flex:1 1 100%;min-width:0}
  .sizedial input{flex:1;width:auto;min-width:0}
  .prosc{padding:.3rem;box-shadow:4px 4px 0 0 var(--edge)}
  .lib .stagezone{gap:var(--gap-m);padding:var(--gap-m)}
  .lib .stagezone>[data-control="card"]{width:clamp(9rem,42vw,12rem)}
}
`;
