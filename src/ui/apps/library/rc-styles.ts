/**
 * The Library's room CSS (Premiere restyle, design/wireframes/premiere/library.html): the rail panel with its room
 * header, the top bar, the Carousel's section headers and rows, and the cards. One frame per group: a card, the
 * rail or a section header is the only framed surface in its place; everything inside is open rows, hairlines or
 * one colored edge. Colors come from theme roles and deck tokens (--accent, --bk-role-select, --premiere-gold,
 * --deck-*); a piece's tone is --t (its accent, else its deck's), a section's deck color is --a.
 */

export const PREF_LAYOUT = "library.layout";
export const PREF_ORDER = "library.order";
/** each deck's own view choice (kind to view id); see sectionView in carousel-core.ts */
export const PREF_VIEWS = "library.views";

export const RC_STYLE = `
/* --cw is the card width the art dial sets: RC's own 23.75rem (380px at default text size) at the
   dial's resting 8.5rem, down to 9rem at its smallest (a tile: art, a readable name, its controls), up to
   the pane's width at its largest. Every step of the dial moves it; nothing parks at a clamp. */
/* the pane container: @container below resolves against THIS, so the room collapses by the pane
   it lives in (a narrow split on a wide monitor too), never by the window */
.lib.rc{padding:0;gap:0;height:100%;min-height:0;background:var(--stage-well);container-type:inline-size;
  --cw:min(calc(9rem + (var(--card-w,8.5rem) - 4rem) * 3.278),85cqi)}
.lframe{display:flex;flex-direction:row;gap:1.25rem;flex:1;min-height:0;padding:.375rem 1.25rem 1rem 1rem}
.lmain{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;gap:.875rem;padding:.875rem .625rem 0 .75rem}

/* -- the rail: one panel, the room header on top, open deck rows below -- */
.lib .lrail{width:20rem;flex:none;display:flex;flex-direction:column;min-height:0;padding:0;font-family:var(--font-ui)}
.lrail-head{padding:1.125rem 1.25rem .875rem;border-bottom:1px solid var(--gold-line)}
.lrail-head [data-control="room-header"]{display:block;padding:0;margin:0;border:0}
.lrail-head [data-slot="title"]{font-size:2rem;letter-spacing:.03em}
.lrail-head [data-slot="title"] em{font-style:normal;color:color-mix(in srgb,var(--accent) 70%,var(--text))}
.lrail-head [data-slot="lede"]{font-size:.8125rem;line-height:1.4}
.lrail-toggle{margin-top:.75rem;display:inline-flex}
.lrail-scroll{flex:1;min-height:0;overflow-y:auto;padding:.25rem .875rem .625rem}
.lrail-div{display:flex;align-items:center;gap:.75rem;margin:1rem 0 .5rem;font:600 var(--text-meta) var(--font-ui);letter-spacing:.2em;text-transform:uppercase;color:var(--premiere-gold)}
.lrail-div::before,.lrail-div::after{content:"";flex:1;height:1px;background:var(--gold-line)}
.lrail-rows{display:flex;flex-direction:column}
.lrail [data-control="row"]{gap:.75rem;padding:.4375rem .625rem .4375rem .75rem;margin:1px 0;border-left:3px solid color-mix(in srgb,var(--row-accent) 35%,transparent);
  border-bottom:1px solid color-mix(in srgb,var(--text) 8%,transparent);transition:transform .2s ease,background .2s ease,border-color .2s ease}
.lrail [data-control="row"]:hover:not(:disabled){transform:translateX(4px);background:color-mix(in srgb,var(--row-accent) 10%,transparent);border-left-color:var(--row-accent)}
.lrail [data-control="row"][data-selected]{background:color-mix(in srgb,var(--row-accent) 12%,transparent);border-left-color:var(--row-accent)}
.lrail .tile{width:2.375rem;height:2.375rem;flex:none;display:grid;place-items:center;border:2px solid color-mix(in srgb,var(--row-accent,var(--accent)) 55%,transparent);
  background:color-mix(in srgb,var(--row-accent,var(--accent)) 12%,var(--stage-black));color:color-mix(in srgb,var(--row-accent,var(--accent)) 70%,var(--text))}
.lrail .tile .ico,.lrail .tile svg{display:block}
.lrail [data-control="row"][data-selected] .tile{background:var(--row-accent);color:var(--stage-ink)}
.lrail .n{font:600 .9375rem/1.2 var(--font-ui);color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lrail .d{font-size:var(--text-meta);color:var(--text-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lrail .cnt{min-width:1.75rem;padding:.25rem .4375rem;text-align:center;font:700 var(--text-meta) var(--font-mono);color:var(--premiere-gold);
  border:1px solid var(--gold-line);background:color-mix(in srgb,var(--stage-black) 60%,transparent)}
.lrail .cnt.zero{color:var(--text-faint);border-color:var(--hair)}
.lrail [data-control="row"][data-selected] .cnt{background:var(--row-accent);border-color:var(--row-accent);color:var(--stage-ink)}
.lrail-add{padding:.875rem;border-top:1px solid var(--gold-line)}

/* -- the top bar -- */
.ltop{display:flex;gap:.75rem;align-items:stretch;flex-wrap:wrap;flex:none}
.ltop .findwrap{flex:1 1 16rem}
.lfilter{display:inline-flex;flex:none}

/* -- the Carousel: section header and rows of cards -- */
.lcar{flex:1;min-height:0;overflow-y:auto;padding:0 .25rem 3rem}
.lsec-wrap:first-child .lsec{margin-top:.25rem}
/* ONE BAND: numeral, title and blurb, then the count, view switch and New; it wraps rather than stacks when the pane is narrow */
.lsec{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.5rem 1.125rem;margin:1.5rem 0 .75rem;
  padding:.625rem .875rem .625rem 1.125rem;scroll-margin-top:.5rem;background:color-mix(in srgb,var(--a,var(--accent)) 9%,var(--glass));
  border:3px solid var(--stage-black);border-left:6px solid var(--a,var(--accent));box-shadow:5px 5px 0 var(--stage-black)}
.lsec .num{font:700 1.75rem/1 var(--font-fancy);color:var(--a,var(--accent))}
.lsec .shead{display:flex;align-items:baseline;flex-wrap:wrap;gap:.2rem 1rem;min-width:0}
.lsec .stitle{margin:0;font:700 1.875rem/1.1 var(--font-fancy);letter-spacing:.04em;text-transform:uppercase;color:var(--text)}
.lsec .stitle em{font-style:normal;color:color-mix(in srgb,var(--a,var(--accent)) 60%,var(--text))}
.lsec .ssub{margin:0;font-size:.875rem;color:var(--text-dim)}
.lsec .sside{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;justify-content:flex-end}
.lsec .scount{padding:.3125rem .75rem;font:600 .8125rem var(--font-ui);color:var(--text-dim);white-space:nowrap;border:1px solid var(--gold-line);background:color-mix(in srgb,var(--stage-black) 60%,transparent)}
.lsec .scount b{font:700 .875rem var(--font-mono);color:var(--premiere-gold)}
.lsec .scount em{font-style:normal;margin-left:.375rem}
.lsec .sviews{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}
.lsec-wrap.solo .lsec{margin-top:.5rem}

/* every card is absolutely positioned (shelves.tsx Row), sized off one measured "probe" card, so overflow-y:visible
   is pinned: a rare taller card in the same row must still show in full rather than clip */
.lrow-cards{display:grid;grid-auto-flow:column;grid-auto-columns:var(--cw);gap:1.5rem;overflow-x:auto;overflow-y:visible;padding:.625rem .75rem 1.5rem .375rem;scrollbar-width:none;align-items:start}
/* a card is its column's width and its height follows from that; a stretched row height must never
   feed back through the aspect ratio into a card wider than its column */
.rcell{min-width:0;display:flex;flex-direction:column;container-type:inline-size}
.rstart{margin-top:.625rem}
.rcell>.rcard{width:100%}
.lrow-cards::-webkit-scrollbar{display:none}
/* RC's grid layout: the same cards wrapping; the padded box is the outer space once (virtualized), each row carries only its template */
.lrow-cards-space{overflow:visible;padding:.5rem .5rem 1rem}
.rgrid-row{display:grid;align-items:start;gap:1.5rem;
  grid-template-columns:repeat(auto-fill,minmax(min(max(8rem,calc(var(--cw) * .63)),100%),1fr))}
.rgrid-row.presets{grid-template-columns:repeat(auto-fill,minmax(min(calc(var(--cw) * .76),100%),1fr))}
/* the New tile that closes a row: dashed in the deck color, solid and lifted on hover */
.rnewcell{display:flex;min-width:0;align-self:stretch;container-type:inline-size}
.rnewcell [data-control="tile"]{border:3px dashed color-mix(in srgb,var(--a,var(--accent)) 55%,transparent);background:color-mix(in srgb,var(--a,var(--accent)) 5%,transparent);
  color:color-mix(in srgb,var(--a,var(--accent)) 60%,var(--text));transition:transform .25s ease,background .25s ease,border-color .25s ease}
.rnewcell [data-control="tile"]:hover:not(:disabled){transform:translateY(-4px);border-style:solid;border-color:var(--a,var(--accent));background:color-mix(in srgb,var(--a,var(--accent)) 14%,transparent)}
.rnewlbl{text-align:center;font:700 var(--text-control) var(--font-ui);letter-spacing:.04em}
/* a section showing a drop-in view: as tall as what it holds, up to a bound, past which it scrolls
   inside itself so the page still flows on to the next deck */
.lview.libstage{flex:none;height:auto;max-height:min(38rem,78vh);display:flex;flex-direction:column}
.lscrub{margin:.25rem .5rem 0;padding:.5rem 0;cursor:pointer;touch-action:none}
.lscrub .track{position:relative;height:6px;border-radius:999px;background:color-mix(in srgb,var(--accent) 12%,transparent)}
.lscrub .thumb{position:absolute;top:0;bottom:0;border-radius:999px;background:color-mix(in srgb,var(--accent) 60%,transparent)}

/* -- the card shell: hard frame, deck-colored top edge, lift on hover; staged takes the deck shadow, open a gold outline -- */
.rcard{position:relative;display:flex;flex-direction:column;overflow:hidden;min-width:0;cursor:pointer;text-align:left;color:var(--text-dim);font-family:var(--font-ui);
  background:var(--glass);border:3px solid var(--stage-black);border-top-color:var(--t);box-shadow:5px 5px 0 var(--stage-black);transition:transform .25s ease,box-shadow .25s ease}
.rcard:hover,.rcard:focus-within{transform:translateY(-6px);box-shadow:5px 5px 0 var(--stage-black),var(--glow)}
.rcard:has([data-part="library.card.name"]:focus-visible){outline:3px solid var(--accent);outline-offset:3px}
.rcard.pick{border-color:var(--t);box-shadow:5px 5px 0 var(--t)}
.rcard.pick:hover{box-shadow:5px 5px 0 var(--t),var(--glow)}
.rcard.cast{outline:1px solid var(--premiere-gold);outline-offset:3px}
.rcheck{position:absolute;top:.625rem;right:.625rem;z-index:6;width:1.625rem;height:1.625rem;background:var(--t);border:2px solid var(--stage-black);display:flex;align-items:center;justify-content:center}
.rcheck::after{content:"";width:.4rem;height:.75rem;border:solid var(--stage-ink);border-width:0 3px 3px 0;transform:translateY(-2px) rotate(45deg)}
.rtick{position:absolute;top:.625rem;left:.625rem;z-index:6;padding:.25rem .625rem;font:600 var(--text-meta) var(--font-ui);background:var(--premiere-gold);color:var(--stage-ink);border:2px solid var(--stage-black)}
.rcard .ico svg{display:block}
.rfoot{margin-top:auto;padding:.5rem 1rem .75rem;border-top:1px solid var(--hair);display:flex;justify-content:space-between;align-items:center;gap:.5rem;font-size:var(--text-meta);color:var(--text-faint)}
.rfoot>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rfoot .grow,.rtools .grow{flex:1}
.ract{display:contents}
.rfacts+.grow{flex:0}
.rfacts{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--text-meta);color:var(--text-faint)}
.rtools{margin-top:auto;display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;padding:.625rem .875rem .75rem;border-top:1px solid var(--hair);
  font:var(--text-control) var(--font-ui);color:var(--text-dim);cursor:default}
.rswl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.rslow{flex:none;padding:.125rem .5rem;border:1px solid var(--premiere-gold);color:var(--premiere-gold);font-size:var(--text-meta)}
.rcard.over{outline:3px dashed var(--accent);outline-offset:4px}
.rdroptip{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);z-index:7;pointer-events:none;white-space:nowrap;
  background:var(--accent-deep);color:var(--stage-white);font:600 var(--text-meta) var(--font-ui);padding:.375rem .625rem;border:2px solid var(--stage-black)}
.rcdef{padding:.1875rem .5625rem;font:600 var(--text-meta) var(--font-ui);background:var(--premiere-gold);color:var(--stage-ink)}
.rmore{display:flex;flex:none}
.rtags{padding:0 1.25rem .875rem;display:flex;gap:.375rem;flex-wrap:wrap}
.rtag{padding:.1875rem .5625rem;font:600 var(--text-meta) var(--font-ui);border:1px solid color-mix(in srgb,var(--t) 55%,transparent);color:color-mix(in srgb,var(--t) 60%,var(--text));background:color-mix(in srgb,var(--t) 10%,transparent)}

/* ContentPresetCard */
.rstrip{padding:.5rem 1rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;min-height:2.3rem;border-bottom:1px solid var(--hair)}
.rstat{display:flex;align-items:baseline;gap:.25rem}
.rstat b{font:700 .875rem var(--font-mono);color:var(--premiere-gold)}
.rstat span{font-size:var(--text-meta);color:var(--text-faint)}
.rstrip .grow{flex:1}
.red{border:1px solid var(--hair);padding:.25rem .5rem;font:700 var(--text-meta) var(--font-mono);color:var(--text)}
.rpcover{position:relative;aspect-ratio:16/7;background-size:cover;background-position:center;border-bottom:1px solid var(--hair)}
.rpcover::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 0%,color-mix(in srgb,var(--stage-panel) 76%,transparent) 100%)}
.rpbody{flex:1;display:flex;flex-direction:column;padding:1.25rem 0 0}
.rphead{display:flex;gap:.875rem;padding:0 1.25rem}
.rphead-tx,.rahead-tx{min-width:0;flex:1 1 0}
.rpicon,.raicon{width:2.375rem;height:2.375rem;flex:none;display:grid;place-items:center;border:2px solid color-mix(in srgb,var(--t) 55%,transparent);
  background:color-mix(in srgb,var(--t) 12%,var(--stage-black));color:color-mix(in srgb,var(--t) 70%,var(--text))}
.rplabel{font-size:var(--text-meta);color:var(--text-faint);margin-bottom:.25rem}
.rptitle{font:700 1.0625rem/1.2 var(--font-fancy);letter-spacing:.02em;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;user-select:text;cursor:text}
.rpdesc{margin:.75rem 1.25rem 0;font-size:.8125rem;line-height:1.6;color:var(--text-dim);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rpbody .rtags{margin-top:1rem}

/* AssetCard (vertical, RC's fixed 520px) */
.rcard.rasset{aspect-ratio:380/520}
/* a themed book is the portrait BookCover composition: library.card variants set the shape (core keeps the square shelf art) */
.rthemeframe{position:absolute;inset:0;z-index:5;pointer-events:none;background:var(--chrome-structure);-webkit-mask:var(--theme-frame-mask) center/100% 100% no-repeat;mask:var(--theme-frame-mask) center/100% 100% no-repeat}
/* a fixed-height card must clip at its foot, never squeeze its lines into each other */
.rcard.rasset>*{flex-shrink:0}
/* ...except the words, which give way first: the tools and footer must always show */
.rcard.rasset>.rabody{flex-shrink:1;min-height:0;overflow:hidden}
/* and the square cover gives way after the words: on a narrow or short card the book's cover crops first */
.rcard.rasset>.rart{flex-shrink:1;min-height:8rem}
.rart{position:relative;flex:none;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;padding:1.25rem;
  background-size:cover;background-position:center top;background-color:var(--stage-well);
  background-image:linear-gradient(180deg,color-mix(in srgb,var(--t) 18%,transparent) 0%,var(--stage-well) 100%)}
.rart.has::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,color-mix(in srgb,var(--stage-panel) 90%,transparent) 100%)}
.rart:not(.has)::before{content:"";position:absolute;left:0;top:0;bottom:0;width:10px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--t) 50%,transparent),color-mix(in srgb,var(--t) 20%,transparent),transparent)}
.rpill{padding:.375rem .75rem;font:600 .75rem var(--font-ui);background:color-mix(in srgb,var(--t) 25%,var(--stage-sunken));border:1px solid color-mix(in srgb,var(--t) 35%,transparent);color:var(--text);z-index:2}
.rglyph{color:var(--t);transform:scale(2.6)}
.roff{position:absolute;bottom:.5rem;left:.5rem;z-index:2;padding:.125rem .5rem;font-size:var(--text-meta);background:var(--stage-black);border:1px solid var(--text-faint);color:var(--text-dim)}
.rasset.off .rart{filter:saturate(.55)}
.rstats{padding:.5rem 1rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap;font-size:var(--text-meta);color:var(--text-faint);border-block:1px solid var(--hair)}
.rstats b{font:700 .875rem var(--font-mono);color:var(--premiere-gold);margin-left:.25rem}
.rahead{padding:1rem 1.25rem .5rem;display:flex;gap:.875rem;align-items:center}
.ratitle{font:700 1.3125rem/1.15 var(--font-fancy);letter-spacing:.02em;color:var(--text);
  overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;user-select:text;cursor:text}
.rameta{font-size:var(--text-meta);color:var(--text-faint);margin-top:.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rasset.book .rabody{display:block;-webkit-line-clamp:unset}
.rabody{padding:.375rem 1.25rem .75rem;font-size:.875rem;line-height:1.5;color:var(--text-dim);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* ContentCharacterCard (RC's DiscoveryCharacterCardV3, library mode): tall, art filling the top and fading out, name and italic tagline below */
.rcard.rchar{aspect-ratio:380/720}
.rcart{flex:1;min-height:0;position:relative;overflow:hidden}
.rcimg{position:absolute;inset:0;display:grid;place-items:center;background-color:var(--stage-well);background-size:cover;background-position:center top;
  -webkit-mask-image:linear-gradient(to bottom,black 67%,transparent 100%);mask-image:linear-gradient(to bottom,black 67%,transparent 100%);
  transition:transform .5s ease;font-family:var(--font-fancy);font-size:min(3.5rem,38cqi);color:var(--t)}
.rchar:hover .rcimg{transform:scale(1.05)}
.rcbody{flex:none;padding:1rem;display:flex;flex-direction:column;min-width:0}
.rcbadges{display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap}
.rcgenre{padding:.1875rem .5625rem;font:600 var(--text-meta) var(--font-ui);border:1px solid color-mix(in srgb,var(--t) 55%,transparent);color:color-mix(in srgb,var(--t) 60%,var(--text));background:color-mix(in srgb,var(--t) 10%,transparent)}
.rcorigin{font:600 var(--text-meta) var(--font-ui);color:var(--text-dim)}
.rctitle{font:700 1.3125rem/1.15 var(--font-fancy);letter-spacing:.02em;color:var(--text);margin-bottom:.25rem;
  overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rcline{margin:0 0 .75rem;font:italic .875rem/1.45 var(--font-ui);color:var(--text-dim);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rcbody .rfoot{margin-top:.25rem;padding:.5rem 0 0}

/* the regex card's own parts; its shell is the shared one above */
.rrhead{padding:.625rem 1rem;display:flex;align-items:center;gap:.75rem;border-bottom:1px solid var(--hair)}
.rrules{font:600 .8125rem var(--font-ui);color:color-mix(in srgb,var(--t) 60%,var(--text))}
.rrfmt{font:600 var(--text-meta) var(--font-ui);color:var(--text-faint)}
.rroff{margin-left:auto;font:600 var(--text-meta) var(--font-ui);color:var(--text-dim);padding:.125rem .5rem;border:1px solid var(--text-faint)}
.rrbody{flex:1;padding:1rem;display:flex;flex-direction:column;gap:.375rem;min-width:0}
.rrtitle{font:700 1.0625rem/1.2 var(--font-fancy);color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rrdate{font-size:var(--text-meta);color:var(--text-faint);margin:0}
.rrdesc{margin:0;font-size:.875rem;line-height:1.5;color:var(--text-dim);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rregex.off{filter:saturate(.55)}

/* -- small cards fold down: the words go first, the controls never do -- */
@container (max-width:15rem){
  .rpdesc,.rabody,.rasset.book .rabody,.rrdesc,.rtags,.rstats,.rfacts,.rswl,.rplabel,.rameta,.rrdate,.rcbadges,.rcline,.rpicon,.raicon,.rpill,.rglyph{display:none}
  .rstrip+.rstrip{display:none}
  .rahead,.rphead{padding:.6rem .6rem .3rem}
  .rpbody{padding-top:.4rem}
  .ratitle,.rptitle,.rrtitle,.rctitle{font-size:.85rem;margin:0}
  .rcbody{padding:.5rem}
  .rtools,.rfoot{padding:.35rem .45rem;gap:.25rem}
  .rrhead,.rrbody,.rstrip{padding:.4rem .5rem}
  .rcard.rasset>.rart{min-height:2.5rem}
}
@container (max-width:11rem){
  .rstrip,.rrhead{display:none}
  /* one line, never broken mid-word, never shrunk past reading size */
  .ratitle,.rptitle,.rrtitle,.rctitle{display:block;-webkit-line-clamp:unset;font-size: var(--text-body);letter-spacing:.02em}
  [data-part="library.card.name"] .rnmx{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* Split and Copy live in the card's menu (right-click or ...): stacked here they were unreadable */
  .ract{display:none}
  /* a book this small is its name and its tools: the cover would crowd the switch out, and the
     card grows to hold them rather than keep a shape that would cut them off */
  .rcard.rasset>.rart{display:none}
  .rcard.rasset{aspect-ratio:auto}
}

/* -- narrow panes: the rail becomes chips above the shelf. They WRAP: everything visible, nothing
   hidden behind an invisible sideways scroll (the rule the old deck chips kept) -- */
@container (max-width:48rem){
  .lframe{flex-direction:column;padding:.5rem .75rem 1rem}
  .lib .lrail{width:auto}
  .lrail-head{display:flex;align-items:center;justify-content:space-between;gap:.4rem;flex-wrap:wrap;padding:.45rem .65rem;border-bottom:1px solid var(--gold-line)}
  .lrail-head [data-slot="kicker"],.lrail-head [data-slot="lede"]{display:none}
  .lrail-head [data-slot="title"]{font-size:var(--text-control);letter-spacing:.06em;white-space:nowrap}
  .lrail-head .lrail-toggle{margin-top:0;flex:none}
  .lrail-scroll{padding:.5rem 0;overflow:visible;flex:none}
  .lrail-div,.lrail-add{display:none}
  .lrail-rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,8rem),1fr));padding:0 .6rem .25rem;gap:.25rem}
  .lrail [data-control="row"]{width:100%;min-width:0;padding:.25rem .35rem;gap:.3rem;border-left:none;border-bottom:3px solid transparent}
  .lrail [data-control="row"][data-selected]{border-bottom-color:var(--row-accent)}
  .lrail .tile{display:none}
  .lrail .cnt{min-width:1.25rem;padding:.125rem .2rem}
  .lrail .d{display:none}
  .lsec{grid-template-columns:auto minmax(0,1fr);padding:.45rem .7rem .45rem 1.1rem}
  .lsec .sside{grid-column:1/-1;justify-content:flex-start}
  .lsec .viewseg{flex:1 1 100%;min-width:0;max-width:100%;flex-wrap:wrap}
}
`;
