/**
 * The RoleCall port's CSS: the rail, the top bar, the Carousel's section headers and rows, and the
 * RC cards. Shapes, borders, and shadows follow RC's components (library-client-v2,
 * LibrarySectionHeader, ContentPresetCard, AssetCard, HorizontalAssetRow).
 *
 * STAGE CHROME TOKENS ONLY for surfaces and their text (--stage-*), never the shell's flipping
 * --text ramp on a stage fill. The stage family flips as ONE set in the paper theme (tan well, ink
 * titles), so a card stays readable in both; mixing the two ramps is how dark text lands on a dark
 * card. The one exception is the top bar (search, All / Recent, Select all): it is shell chrome
 * like the search box it sits beside, so it wears the shell ramp (--face, --edge, --text) as that
 * box does, in both themes. A piece's tone is --t (its accent, else its deck's); the person's
 * accent is --accent.
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
.lframe{display:flex;flex-direction:row;flex:1;min-height:0}
/* RC sets its sidebar, headers, and cards in Inter; Bunraku's Inter is --font-big (Fraunces). Named
   here, because these parts otherwise inherited the page's serif. Cinzel titles and italic taglines
   name their own. */
.lrail,.lsec,.rcard,.rnewtile{font-family:var(--font-big)}
.lmain{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;gap:.7rem;padding:.9rem clamp(.7rem,2vw,1.75rem) .9rem}

/* -- the rail (library-client-v2's collection sidebar) -- */
.lrail{width:20rem;flex:none;display:flex;flex-direction:column;min-height:0;background:var(--stage-well);border-right:2px solid var(--stage-black)}
.lrail-head{padding:1.5rem 1.5rem 1rem;text-align:center;background:var(--stage-sunken);border-bottom:2px solid var(--stage-black)}
.lrail-head .ey{font-family:var(--font-fancy);font-size: var(--text-meta);letter-spacing:.28em;text-transform:uppercase;color:var(--stage-kicker);margin-bottom:.5rem}
.lrail-head .ttl{font-family:var(--font-fancy);font-size:1.625rem;letter-spacing:.24em;font-weight:600;color:var(--stage-card)}
.lrail-head .ttl em{font-style:normal;color:var(--accent)}
.lrail-toggle{margin-top:.75rem;display:inline-flex;border:2px solid var(--stage-black);background:var(--stage-black);gap:1px}
.lrail-toggle button{padding:.375rem 1rem;font-family:var(--font-fancy);font-weight:700;font-size: var(--text-control);letter-spacing:.1em;text-transform:uppercase;
  border:none;background:var(--stage-well);color:var(--stage-mute);cursor:pointer}
.lrail-toggle button.on{background:var(--accent-deep);color:var(--stage-white)}
.lrail-toggle button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.lrail-scroll{flex:1;min-height:0;overflow-y:auto;padding-top:1rem}
.lrail-div{display:flex;align-items:center;gap:.625rem;padding:0 1.25rem .5rem;font-family:var(--font-fancy);font-size: var(--text-meta);letter-spacing:.2em;text-transform:uppercase;color:var(--stage-kicker)}
.lrail-div::before,.lrail-div::after{content:"";flex:1;height:1px;background:var(--stage-seam)}
.lrail-rows{display:flex;flex-direction:column;padding:0 1.25rem .5rem}
.lrail .lrow{display:flex;align-items:center;gap:.75rem;padding:.625rem .75rem;border:none;border-left:3px solid transparent;background:transparent;
  font:inherit;text-align:left;cursor:pointer;color:inherit;width:100%}
.lrail .lrow:hover{background:color-mix(in srgb,var(--accent) 5%,transparent)}
.lrail .lrow:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.lrail .lrow.on{background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 10%,transparent),transparent);border-left-color:var(--accent)}
.lrail .tile{width:2.5rem;height:2.5rem;flex:none;display:grid;place-items:center;background:var(--stage-sunken);border:2px solid var(--stage-black);color:var(--stage-mute)}
.lrail .tile .ico,.lrail .tile svg{display:block}
.lrail .lrow.on .tile{background:color-mix(in srgb,var(--accent) 18%,var(--stage-sunken));border-color:var(--accent);box-shadow:2px 2px 0 var(--stage-black);color:var(--stage-card)}
.lrail .tx{flex:1;min-width:0;display:flex;flex-direction:column}
.lrail .n{font-size:.9375rem;font-weight:500;color:var(--stage-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lrail .lrow.on .n{color:var(--stage-card)}
.lrail .d{font-size:.75rem;color:var(--stage-text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lrail .cnt{min-width:2rem;padding:.25rem .625rem;text-align:center;font-family:var(--font-mono);font-size:.78rem;font-weight:700;
  background:var(--stage-sunken);border:1.5px solid color-mix(in srgb,var(--accent) 50%,transparent);color:var(--stage-soft)}
.lrail .lrow.on .cnt{border-color:var(--accent);color:var(--stage-card)}
.lrail .cnt.zero{border-color:var(--stage-seam);color:var(--stage-mute)}
.lrail-add{padding:1.25rem;background:var(--stage-sunken);border-top:2px solid var(--stage-black)}
.lrail-add button{width:100%;padding:.875rem;font-family:var(--font-fancy);font-weight:800;font-size: var(--text-control);letter-spacing:.2em;text-transform:uppercase;
  color:var(--stage-white);background:linear-gradient(180deg,var(--accent-deep),color-mix(in srgb,var(--accent-deep) 70%,var(--stage-black)));
  border:2px solid var(--stage-black);box-shadow:4px 4px 0 var(--stage-black);cursor:pointer}
.lrail-add button:active{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--stage-black)}
.lrail-add button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* -- the top bar -- */
.ltop{display:flex;gap:.625rem;align-items:stretch;flex-wrap:wrap;flex:none}
.ltop .findwrap{flex:1 1 16rem}
.lfilter{display:inline-flex;border:3px solid var(--edge);box-shadow:3px 3px 0 var(--edge);flex:none}
.lfilter button,.ltb{font-family:var(--font-fancy);font-weight:700;font-size: var(--text-control);letter-spacing:.14em;text-transform:uppercase;padding:0 1rem;min-height:2.375rem;
  background:var(--face);color:var(--text-soft);border:none;border-left:2px solid var(--edge);cursor:pointer}
.lfilter button:first-child{border-left:none}
.lfilter button.on{background:var(--accent-deep);color:var(--stage-white)}
.ltb{border:3px solid var(--edge);box-shadow:3px 3px 0 var(--edge);flex:none}
.lfilter button:focus-visible,.ltb:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* -- the Carousel: LibrarySectionHeader + HorizontalAssetRow -- */
.lcar{flex:1;min-height:0;overflow-y:auto;padding:0 .25rem 3rem}
.lsec-wrap:first-child .lsec{margin-top:.25rem}
/* ONE THIN STRIP: numeral, title and blurb on a line, the count, view switch and New beside them;
   it wraps rather than stacks when the pane is narrow */
.lsec{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:.4rem 1rem;margin:1.5rem 0 .75rem;
  padding:.45rem .9rem .45rem 1.3rem;scroll-margin-top:.5rem;
  background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 13%,transparent) 0%,color-mix(in srgb,var(--accent) 6%,transparent) 35%,transparent 75%),var(--stage-panel);
  border:2px solid var(--stage-black);box-shadow:4px 4px 0 var(--stage-black)}
.lsec::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--accent)}
.lsec .num{font-family:var(--font-fancy);font-weight:900;font-size:1.45rem;letter-spacing:.04em;color:var(--accent);line-height:1;text-shadow:1px 1px 0 var(--stage-sunken)}
.lsec .shead{display:flex;align-items:baseline;flex-wrap:wrap;gap:.2rem .75rem;flex:1 1 auto;min-width:0}
.lsec .stitle{margin:0;font-family:var(--font-fancy);font-weight:900;font-size:1.35rem;letter-spacing:.06em;text-transform:uppercase;
  color:var(--stage-card);text-shadow:2px 2px 0 var(--stage-sunken);line-height:1}
.lsec .stitle em{font-style:normal;color:var(--accent)}
.lsec .ssub{margin:0;font-size:.85rem;color:var(--stage-soft)}
.lsec .scount{padding:.2rem .6rem;font-family:var(--font-mono);font-size:.8rem;font-weight:700;color:var(--stage-card);background:var(--stage-sunken);
  border:2px solid color-mix(in srgb,var(--accent) 52%,transparent);white-space:nowrap}
.lsec .scount em{font-style:normal;color:var(--accent);margin-left:.5rem}
/* the count, the deck's view switch, and New sit in the same strip, after the title */
.lsec .sside{display:contents}
.lsec .sviews{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}
  .lsec .viewseg{border-width:2px;box-shadow:2px 2px 0 0 var(--stage-black)}
  .lsec .viewseg button{padding:.25rem .5rem;font-size:var(--text-control)}
.lsec-wrap.solo .lsec{margin-top:.5rem}
/* the deck New button, as the old stage crumb drew it, on stage chrome */
.lsec .crumbsel{font-family:var(--font-mono);font-weight:700;font-size: var(--text-control);letter-spacing:.1em;text-transform:uppercase;background:transparent;
  color:var(--stage-text-dim);border:2px solid var(--stage-line);cursor:pointer;padding:.3rem .55rem}
.lsec .crumbsel:hover,.lsec .crumbsel:focus-visible{color:var(--stage-card);border-color:var(--accent);outline:none}

/* overflow-y:visible pinned explicitly: every card is absolutely
   positioned now (shelves.tsx Row), sized off one measured "probe" card rather than every
   in-flow child the way align-items:start used to size this row - a rare taller card in the
   same row must still show in full rather than clip against an under-measured row height. */
.lrow-cards{display:grid;grid-auto-flow:column;grid-auto-columns:var(--cw);gap:1.25rem;overflow-x:auto;overflow-y:visible;padding:.5rem .75rem 1.5rem .5rem;scrollbar-width:none;align-items:start}
/* a card is its column's width and its height follows from that; a stretched row height must never
   feed back through the aspect ratio into a card wider than its column */
.rcell{min-width:0;display:flex;flex-direction:column;container-type:inline-size}
/* RoleCall's Start Scene under a character card */
.rstart{margin-top:8px;height:32px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:2px;cursor:pointer;background:linear-gradient(135deg,var(--t,var(--deck-character)),color-mix(in srgb,var(--t,var(--deck-character)) 80%,transparent));box-shadow:0 4px 12px color-mix(in srgb,var(--t,var(--deck-character)) 25%,transparent);font: 600 var(--text-control) var(--font-big);letter-spacing:.05em;text-transform:uppercase;color:var(--stage-ink)}
.rstart:hover{filter:brightness(1.1)}
.rcell>.rcard{width:100%}
.lrow-cards::-webkit-scrollbar{display:none}
/* RC's grid layout: the same cards wrapping; preset rows run three wide cards per row, as RC's
   six-column grid with col-span-2 presets does. VIRTUALIZED: the padded,
   overflow:visible box is the outer space (.lrow-cards-space) now, once, not per row - each row
   below carries only the template a virtualized row needs to read and lay out its own slice. */
.lrow-cards-space{overflow:visible;padding:.5rem .5rem 1rem}
.rgrid-row{display:grid;align-items:start;gap:1.25rem;
  grid-template-columns:repeat(auto-fill,minmax(min(max(8rem,calc(var(--cw) * .63)),100%),1fr))}
.rgrid-row.presets{grid-template-columns:repeat(auto-fill,minmax(min(calc(var(--cw) * .76),100%),1fr))}
/* the New tile that closes a row, as the old shelves' New set and New persona cards did */
.rnewcell{display:flex;min-width:0;align-self:stretch;container-type:inline-size}
.rnewtile{flex:1;min-height:6rem;display:grid;place-items:center;padding:.4rem;text-align:center;font-size:var(--text-control);border:3px dashed var(--stage-line);background:transparent;cursor:pointer;
  font-family:var(--font-big);font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--stage-text-dim)}
.rnewtile:hover,.rnewtile:focus-visible{border-color:var(--accent);color:var(--stage-card);outline:none}
/* a section showing a drop-in view: as tall as what it holds, up to a bound, past which it scrolls
   inside itself so the page still flows on to the next deck */
.lview.libstage{flex:none;height:auto;max-height:min(38rem,78vh);display:flex;flex-direction:column}
.lscrub{margin:.25rem .5rem 0;padding:.5rem 0;cursor:pointer;touch-action:none}
.lscrub .track{position:relative;height:6px;border-radius:999px;background:color-mix(in srgb,var(--accent) 12%,transparent)}
.lscrub .thumb{position:absolute;top:0;bottom:0;border-radius:999px;background:color-mix(in srgb,var(--accent) 60%,transparent)}

/* -- the card shell -- */
.rcard{position:relative;display:flex;flex-direction:column;overflow:hidden;min-width:0;cursor:pointer;text-align:left;color:var(--stage-soft);
  background:linear-gradient(180deg,color-mix(in srgb,var(--t) 12%,var(--stage-panel)) 0%,color-mix(in srgb,var(--t) 4%,var(--stage-panel)) 22%,var(--stage-panel) 45%);
  border:3px solid var(--stage-black);box-shadow:6px 6px 0 var(--stage-black);transition:transform .2s ease,box-shadow .2s ease}
.rcard:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 var(--stage-black),0 0 28px color-mix(in srgb,var(--t) 32%,transparent)}
.rcard:has(.rname:focus-visible){outline:3px solid var(--accent);outline-offset:3px}
/* the stage control IS the name: a real button, text still selectable so an id can be copied */
/* width:100%: a button sizes to its text even as a block, so a long name overran the card */
.rname{all:unset;display:block;width:100%;box-sizing:border-box;min-width:0;cursor:pointer;user-select:text}
.rname:focus-visible{outline:none}
.rcard::before{content:"";position:absolute;inset:0;border:1px solid color-mix(in srgb,var(--stage-card) 16%,transparent);z-index:4;pointer-events:none}
.rcard::after{content:"";position:absolute;inset:4px;border:1px solid var(--t);opacity:.4;z-index:3;pointer-events:none}
/* STAGED: accent outline + corner check, lifted; OPEN: pressed in, a quiet tick (the Grid's grammar) */
.rcard.pick{outline:3px solid var(--accent);outline-offset:-3px;transform:translate(-3px,-3px);box-shadow:9px 9px 0 var(--accent)}
.rcard.cast{transform:translate(2px,2px);box-shadow:inset 5px 5px 0 var(--shadow-ink);opacity:.78}
.rcheck{position:absolute;top:0;right:0;z-index:6;width:1.4rem;height:1.4rem;background:var(--accent);border-left:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black);
  display:flex;align-items:center;justify-content:center}
.rcheck::after{content:"";width:.45rem;height:.8rem;border:solid var(--stage-ink);border-width:0 3px 3px 0;transform:translateY(-2px) rotate(45deg)}
.rtick{position:absolute;top:0;right:0;z-index:6;background:var(--t);color:var(--stage-ink);font-family:var(--font-mono);font-size: var(--text-meta);font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;padding:2px 6px;border-left:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black)}
.rcard .ico svg{display:block}
.rfoot{margin-top:auto;padding:.875rem 1.25rem;border-top:1px solid color-mix(in srgb,var(--stage-card) 8%,transparent);background:var(--stage-row);
  display:flex;justify-content:space-between;align-items:center;gap:.75rem;font-size:.75rem;color:var(--stage-text-dim)}
.rfoot>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rfoot .grow,.rtools .grow{flex:1}
.rfacts+.grow{flex:0}
.rfacts{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.75rem;color:var(--stage-text-dim)}
.rtools{margin-top:auto;display:flex;align-items:center;flex-wrap:wrap;gap:.4rem;padding:.625rem 1rem;border-top:1px dashed var(--stage-seam);background:var(--stage-row);
  font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-text-dim);cursor:default}
.ract:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.rswl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ract{flex:none;font:700 max(14px,var(--text-control)) var(--font-mono);padding:.2rem .45rem;border:1px solid var(--stage-line);background:transparent;color:var(--stage-card);cursor:pointer}
.ract:hover{border-color:var(--accent)}
.rslow{flex:none;padding:.125rem .375rem;border:1px solid var(--stage-warn);background:var(--stage-warn-ink);color:var(--stage-warn)}
.rcard.over{outline:3px dashed var(--accent);outline-offset:4px}
.rdroptip{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);z-index:7;pointer-events:none;white-space:nowrap;
  background:var(--accent-deep);color:var(--stage-white);font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.1em;text-transform:uppercase;
  padding:.375rem .625rem;border:2px solid var(--stage-black)}
.rcdef{padding:.125rem .45rem;font-family:var(--font-mono);font-size: var(--text-meta);font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  background:var(--accent-deep);color:var(--stage-white)}
.rmore{width:2.125rem;height:2.125rem;flex:none;display:grid;place-items:center;background:var(--stage-sunken);border:2px solid var(--stage-seam);color:var(--stage-card);cursor:pointer}
.rmore:hover,.rmore:focus-visible{border-color:var(--accent);outline:none}
.rtags{padding:0 1.25rem .875rem;display:flex;gap:.375rem;flex-wrap:wrap}
.rtag{padding:.25rem .625rem;border-radius:6px;font-size: var(--text-meta);background:color-mix(in srgb,var(--t) 14%,transparent);color:var(--stage-card)}

/* ContentPresetCard */
.rstrip{padding:.5rem 1rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;min-height:2.3rem;
  background:linear-gradient(180deg,color-mix(in srgb,var(--t) 8%,transparent),color-mix(in srgb,var(--t) 2%,transparent));border-bottom:1px solid color-mix(in srgb,var(--t) 12%,transparent)}
.rstat{display:flex;align-items:baseline;gap:.25rem}
.rstat b{font-size:.75rem;font-weight:700;color:var(--stage-card)}
.rstat span{font-size: var(--text-meta);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-text-dim)}
.rstrip .grow{flex:1}
.red{border:1px solid color-mix(in srgb,var(--stage-card) 22%,transparent);background:var(--stage-sunken);padding:.25rem .5rem;font-family:var(--font-mono);font-size: var(--text-meta);
  font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--stage-card)}
.rpcover{position:relative;aspect-ratio:16/7;background-size:cover;background-position:center;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent)}
.rpcover::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 0%,color-mix(in srgb,var(--stage-panel) 76%,transparent) 100%),
  linear-gradient(90deg,color-mix(in srgb,var(--t) 21%,transparent),transparent 45%)}
.rpbody{flex:1;display:flex;flex-direction:column;padding:1.25rem 0 0;background:linear-gradient(135deg,color-mix(in srgb,var(--t) 7%,transparent) 0%,transparent 60%)}
.rphead{display:flex;gap:.875rem;padding:0 1.25rem}
.rphead-tx,.rahead-tx{min-width:0;flex:1 1 0}
.rpicon{width:3.5rem;height:3.5rem;flex:none;display:grid;place-items:center;border-radius:2px;background:color-mix(in srgb,var(--t) 15%,transparent);
  border:1px solid color-mix(in srgb,var(--t) 30%,transparent);color:var(--t)}
.rplabel{font-size: var(--text-meta);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-text-dim);margin-bottom:.25rem}
.rptitle{font-family:var(--font-fancy);font-weight:600;font-size:1rem;color:var(--stage-card);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;user-select:text;cursor:text}
.rpdesc{margin:.75rem 1.25rem 0;font-size:.8125rem;line-height:1.6;color:var(--stage-text-dim);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rpbody .rtags{margin-top:1rem}

/* AssetCard (vertical, RC's fixed 520px) */
.rcard.rasset{aspect-ratio:380/520}
/* a themed book is the portrait BookCover composition: library.card variants set the shape (core keeps the square shelf art) */
.rthemeframe{position:absolute;inset:0;z-index:5;pointer-events:none;background:var(--chrome-structure);-webkit-mask:var(--theme-frame-mask) center/100% 100% no-repeat;mask:var(--theme-frame-mask) center/100% 100% no-repeat}
/* a fixed-height card must clip at its foot, never squeeze its lines into each other */
.rcard.rasset>*{flex-shrink:0}
/* ...except the words, which give way first: the tools and footer must always show */
.rcard.rasset>.rabody{flex-shrink:1;min-height:0;overflow:hidden}
/* and the square cover gives way after the words: on a narrow or short card the book's cover
   crops before its tools could be pushed out of the fixed height */
.rcard.rasset>.rart{flex-shrink:1;min-height:8rem}
.rart{position:relative;flex:none;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;padding:1.25rem;
  background-size:cover;background-position:center top;background-color:var(--stage-well);
  background-image:linear-gradient(180deg,color-mix(in srgb,var(--t) 18%,transparent) 0%,var(--stage-well) 100%),
  repeating-linear-gradient(90deg,transparent 0 2px,color-mix(in srgb,var(--t) 6%,transparent) 2px 4px)}
.rart.has::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,color-mix(in srgb,var(--stage-panel) 90%,transparent) 100%)}
.rart:not(.has)::before{content:"";position:absolute;left:0;top:0;bottom:0;width:10px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--t) 50%,transparent),color-mix(in srgb,var(--t) 20%,transparent),transparent)}
.rpill{padding:.375rem .75rem;border-radius:20px;font-size:.75rem;font-weight:600;background:color-mix(in srgb,var(--t) 25%,var(--stage-sunken));
  border:1px solid color-mix(in srgb,var(--t) 35%,transparent);color:var(--stage-card);z-index:2}
.rglyph{color:var(--t);transform:scale(2.6)}
.roff{position:absolute;top:.5rem;left:.75rem;font-family:var(--font-mono);font-size: var(--text-meta);font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  padding:.125rem .4rem;background:var(--stage-sunken);color:var(--stage-card);border:1px solid var(--stage-line)}
.rasset.off .rart{filter:grayscale(.7)}
.rstats{padding:.625rem 1rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap;font-size: var(--text-meta);color:var(--stage-text-dim);
  background:linear-gradient(180deg,color-mix(in srgb,var(--t) 8%,transparent),color-mix(in srgb,var(--t) 2%,transparent));border-bottom:1px solid color-mix(in srgb,var(--t) 10%,transparent)}
.rstats b{font-size:.75rem;font-weight:700;color:var(--stage-card);margin-left:.25rem}
.rahead{padding:1.25rem;display:flex;gap:.875rem}
.raicon{width:3rem;height:3rem;flex:none;border-radius:12px;display:grid;place-items:center;color:var(--t);
  background:linear-gradient(135deg,color-mix(in srgb,var(--t) 18%,transparent),color-mix(in srgb,var(--t) 4%,transparent));border:1px solid color-mix(in srgb,var(--t) 30%,transparent)}
.ratitle{font-family:var(--font-fancy);font-weight:700;font-size:1.25rem;letter-spacing:.03em;line-height:1.15;color:var(--stage-card);text-shadow:1px 1px 0 var(--stage-sunken);
  overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;user-select:text;cursor:text}
.rameta{font-size:.75rem;color:var(--stage-text-dim);margin-top:.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rasset.book .rabody{display:block;-webkit-line-clamp:unset}
.rabody{padding:0 1.25rem 1rem;font-size:.875rem;line-height:1.55;color:var(--stage-soft);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* ContentCharacterCard (RC's DiscoveryCharacterCardV3, library mode): tall, signature-colored
   border and shadow, art filling the top and fading out, name and italic tagline below */
.rcard.rchar{aspect-ratio:380/720;border:3px solid var(--t);box-shadow:6px 6px 0 color-mix(in srgb,var(--t) 67%,transparent);
  background:linear-gradient(180deg,color-mix(in srgb,var(--t) 3%,var(--stage-panel)) 0%,var(--stage-panel) 30%)}
.rcard.rchar:hover{transform:translate(-2px,-2px) scale(1.01);box-shadow:9px 9px 0 var(--t),0 0 28px color-mix(in srgb,var(--t) 33%,transparent)}
.rcard.rchar::before{border-color:color-mix(in srgb,var(--stage-card) 22%,transparent)}
.rcard.rchar::after{opacity:.5}
.rcard.rchar:hover::after{opacity:.9}
.rcart{flex:1;min-height:0;position:relative;overflow:hidden}
.rcimg{position:absolute;inset:0;display:grid;place-items:center;background-color:var(--stage-well);background-size:cover;background-position:center top;
  -webkit-mask-image:linear-gradient(to bottom,black 67%,transparent 100%);mask-image:linear-gradient(to bottom,black 67%,transparent 100%);
  transition:transform .5s ease;font-family:var(--font-fancy);font-size:min(3.5rem,38cqi);color:var(--t)}
.rchar:hover .rcimg{transform:scale(1.05)}
.rcbody{flex:none;padding:1rem;background:var(--stage-panel);display:flex;flex-direction:column;min-width:0}
.rcbadges{display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap}
.rcgenre{padding:.125rem .5rem;font-size: var(--text-meta);font-weight:700;letter-spacing:.05em;text-transform:uppercase;background:var(--t);color:var(--stage-ink)}
.rcorigin{font-size: var(--text-meta);font-weight:700;color:var(--stage-soft)}
.rctitle{font-family:var(--font-fancy);font-size:.9375rem;font-weight:700;letter-spacing:.03em;color:var(--stage-card);margin-bottom:.25rem;
  overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rcline{margin:0 0 .75rem;font-family:var(--font-body);font-style:italic;font-size:.9375rem;line-height:1.35;color:var(--stage-soft);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rcbody .rfoot{margin-top:.25rem;padding:0;background:transparent;border-top:none}

/* the regex card's own parts; its shell is the shared one above */
.rrhead{padding:.625rem 1rem;display:flex;align-items:center;gap:.75rem;
  background:linear-gradient(180deg,color-mix(in srgb,var(--t) 12%,transparent),color-mix(in srgb,var(--t) 4%,transparent));border-bottom:1px solid color-mix(in srgb,var(--t) 10%,transparent)}
.rrules{font-size:.75rem;font-weight:600;color:color-mix(in srgb,var(--t) 55%,var(--stage-card))}
.rrfmt{font-size:.75rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--stage-text-dim)}
.rroff{margin-left:auto;font-family:var(--font-mono);font-size: var(--text-meta);font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--stage-card);
  padding:.125rem .4rem;border:1px solid var(--stage-line)}
.rrbody{flex:1;padding:1rem;display:flex;flex-direction:column;min-width:0}
.rrtitle{font-size:1rem;font-weight:600;color:var(--stage-card);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rrdate{font-size: var(--text-meta);color:var(--stage-text-dim);margin:.25rem 0 .5rem}
.rrdesc{margin:0;font-size:.8125rem;line-height:1.6;color:var(--stage-text-dim);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rregex.off .rrhead{filter:grayscale(.7)}

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
  .rname .rnmx{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* Split and Copy live in the card's menu (right-click or ...): stacked here they were unreadable */
  .ract{display:none}
  /* a book this small is its name and its tools: the cover would crowd the switch out, and the
     card grows to hold them rather than keep a shape that would cut them off */
  .rcard.rasset>.rart{display:none}
  .rcard.rasset{aspect-ratio:auto}
  .rmore{width:1.5rem;height:1.5rem}
}

/* -- narrow panes: the rail becomes chips above the shelf. They WRAP: everything visible, nothing
   hidden behind an invisible sideways scroll (the rule the old deck chips kept) -- */
@container (max-width:48rem){
  .lframe{flex-direction:column}
  .lrail{width:auto;border-right:none;border-bottom:2px solid var(--stage-black)}
  .lrail-head{display:flex;align-items:center;justify-content:space-between;gap:.4rem;flex-wrap:wrap;padding:.45rem .65rem;text-align:left}
  .lrail-head .ey{display:none}
  .lrail-head .ttl{font-size:var(--text-control);letter-spacing:.06em;white-space:nowrap}
  .lrail-head .lrail-toggle{margin-top:0;flex:none}
  .lrail-head .lrail-toggle button{padding:.3rem .6rem}
  .lrail-scroll{padding:.5rem 0;overflow:visible;flex:none}
  .lrail-div,.lrail-add{display:none}
  .lrail-rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,8rem),1fr));padding:0 .6rem .25rem;gap:.25rem}
  .lrail .lrow{width:100%;min-width:0;padding:.25rem .35rem;gap:.3rem;border-left:none;border-bottom:3px solid transparent}
  .lrail .lrow.on{border-bottom-color:var(--accent)}
  .lrail .tile{display:none}
  .lrail .tx{flex:1;min-width:0}
  .lrail .cnt{min-width:1.25rem;padding:.125rem .2rem}
  .lrail .d{display:none}
  .lsec .viewseg{flex:1 1 100%;min-width:0;max-width:100%;flex-wrap:wrap}
  .lsec .viewseg button{flex:1 1 auto}
  .lsec{padding:.45rem .7rem .45rem 1.1rem}
}

`;
