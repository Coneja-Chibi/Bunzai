window.QUIZ_PARTS = window.QUIZ_PARTS || {};
window.QUIZ_PARTS["design"] = {
label: "Design",
title: "How it should work",
intro: "Not vibes this time, actual screens. Each option below is a small drawn mockup of a real Bunzai layout. Pick the one you would actually want to use, every day. Notes are welcome on any of them.",
css: `
/* ---- scoped tokens for this quiz's mockups ---- */
.qz-design { --d-char: var(--rose); --d-persona: var(--sky); --d-lore: var(--mint); --d-preset: var(--gold); --d-pack: var(--lilac); --ink: var(--floor); }

/* ---- the screen shell every mockup renders inside ---- */
.qz-design .scr { width: 100%; height: 190px; overflow: hidden; position: relative; display: flex; background: var(--well); box-shadow: inset 0 0 0 2px var(--seam); font: 11px/1.3 var(--f-body); color: var(--paper); box-sizing: border-box; }
.qz-design .scr * { box-sizing: border-box; }
.qz-design .scr.tall { height: 240px; }
.qz-design .scr.short { height: 150px; }
.qz-design .scr.col { flex-direction: column; }

/* ---- left dock (open and icon-collapsed) ---- */
.qz-design .mdock { flex: none; width: 56px; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 3px; background: var(--deck); box-shadow: inset -1px 0 0 var(--seam); }
.qz-design .mdock.icons { width: 28px; }
.qz-design .mdock .mi { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 1px; color: var(--mute); }
.qz-design .mdock .mi.on { color: var(--rose); }
.qz-design .mdock .mi i { width: 13px; height: 13px; flex: none; box-shadow: inset 0 0 0 1.5px currentColor; }
.qz-design .mdock .mi b { font: 600 6.5px var(--f-mono); text-transform: uppercase; letter-spacing: .04em; }
.qz-design .mdock.icons .mi b { display: none; }

/* ---- top bar ---- */
.qz-design .mtop { flex: none; width: 100%; display: flex; align-items: center; gap: 2px; padding: 5px 7px; background: var(--deck); box-shadow: inset 0 -1px 0 var(--seam); }
.qz-design .mtop .mt { font: 600 7px var(--f-mono); text-transform: uppercase; letter-spacing: .04em; color: var(--mute); padding: 3px 7px; }
.qz-design .mtop .mt.on { color: var(--ink); background: var(--rose); }

/* ---- bottom HUD bar ---- */
.qz-design .mhud { position: absolute; left: 0; right: 0; bottom: 0; height: 24px; display: flex; align-items: center; justify-content: space-around; background: var(--deck); box-shadow: inset 0 1px 0 var(--seam); z-index: 2; }
.qz-design .mhud .mi { display: flex; flex-direction: column; align-items: center; gap: 1px; color: var(--mute); }
.qz-design .mhud .mi.on { color: var(--rose); }
.qz-design .mhud .mi i { width: 11px; height: 11px; box-shadow: inset 0 0 0 1.5px currentColor; }
.qz-design .mhud .mi b { font: 600 6px var(--f-mono); text-transform: uppercase; }

/* ---- content body ---- */
.qz-design .mbody { flex: 1; min-width: 0; min-height: 0; position: relative; overflow: hidden; background: var(--floor); }
.qz-design .mpad { padding: 7px; height: 100%; overflow: hidden; }

/* ---- avatars (square, never circular) ---- */
.qz-design .av { display: grid; place-items: center; font: 700 10px var(--f-mono); color: var(--ink); background: var(--t, var(--rose)); flex: none; }

/* ---- library cards ---- */
.qz-design .mgrid { display: flex; gap: 5px; flex-wrap: wrap; align-content: flex-start; height: 100%; }
.qz-design .mcard { position: relative; background: var(--panel); box-shadow: 0 0 0 1px var(--seam); border-top: 3px solid var(--t, var(--rose)); overflow: hidden; display: flex; align-items: flex-end; flex: none; }
.qz-design .mcard .ov { width: 100%; padding: 3px 4px; background: linear-gradient(transparent, rgba(0,0,0,.78)); }
.qz-design .mcard .ov b { display: block; font: 700 7px var(--f-big); }
.qz-design .mcard .ov small { display: block; font: 500 6px var(--f-mono); color: var(--mute); }
.qz-design .mcard.big { width: 56px; height: 84px; }
.qz-design .mcard.med { width: 40px; height: 60px; }

/* ---- list rows ---- */
.qz-design .mrow { display: flex; align-items: center; gap: 6px; padding: 4px 6px; box-shadow: inset 0 -1px 0 var(--seam); background: var(--panel); }
.qz-design .mrow .av { width: 18px; height: 18px; font-size: 8px; }
.qz-design .mrow .tx { flex: 1; min-width: 0; overflow: hidden; }
.qz-design .mrow .tx b { display: block; font: 600 7.5px var(--f-big); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qz-design .mrow .tx small { display: block; font: 500 6.5px var(--f-mono); color: var(--mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ---- chips, buttons, switches ---- */
.qz-design .chip { font: 600 6.5px var(--f-mono); text-transform: uppercase; letter-spacing: .04em; padding: 2px 5px; background: var(--row); box-shadow: inset 0 0 0 1px var(--line); color: var(--soft); flex: none; }
.qz-design .chip.on { background: var(--rose); color: var(--ink); box-shadow: none; }
.qz-design .mbtn { font: 700 7px var(--f-mono); text-transform: uppercase; padding: 3px 8px; background: var(--rose); color: var(--ink); display: inline-block; }
.qz-design .mbtn.ghost { background: none; box-shadow: inset 0 0 0 1px var(--line); color: var(--soft); }
.qz-design .mbtn.danger { background: #ff3b4f; color: var(--ink); }
.qz-design .msw { width: 18px; height: 10px; background: var(--row); box-shadow: inset 0 0 0 1px var(--line); position: relative; display: inline-block; }
.qz-design .msw.on { background: var(--mint); }
.qz-design .msw i { position: absolute; top: 1px; left: 1px; width: 8px; height: 8px; background: var(--paper); }
.qz-design .msw.on i { left: 9px; background: var(--ink); }

/* ---- scene list: hero + preview, and alternatives ---- */
.qz-design .mhero { display: flex; gap: 5px; padding: 6px; height: 100%; }
.qz-design .mhero .big { flex: 1.1; background: var(--panel); box-shadow: 0 0 0 1px var(--seam); border-top: 3px solid var(--d-char); display: flex; align-items: flex-end; padding: 5px; position: relative; }
.qz-design .mhero .prev { flex: 1; background: var(--panel); box-shadow: 0 0 0 1px var(--seam); display: flex; flex-direction: column; justify-content: flex-end; padding: 6px; gap: 4px; }
.qz-design .mbanner { height: 46px; background: linear-gradient(100deg, color-mix(in srgb, var(--d-char) 45%, var(--panel)), var(--panel)); box-shadow: 0 0 0 1px var(--seam); display: flex; align-items: center; padding: 0 8px; gap: 6px; margin-bottom: 5px; flex: none; }

/* ---- chat styles ---- */
.qz-design .mchat { display: flex; flex-direction: column; height: 100%; justify-content: flex-end; gap: 4px; }
.qz-design .mbub { max-width: 72%; padding: 4px 7px; font: 7.5px/1.35 var(--f-body); }
.qz-design .mbub.them { background: var(--panel); align-self: flex-start; }
.qz-design .mbub.you { background: var(--rose-deep); color: var(--paper); align-self: flex-end; }
.qz-design .mprose p { margin: 0 0 6px; font: 7.5px/1.5 var(--f-body); color: var(--soft); }
.qz-design .mprose b { color: var(--d-char); }
.qz-design .mvn { position: relative; height: 100%; background: linear-gradient(165deg, color-mix(in srgb, var(--d-char) 38%, var(--well)), var(--well) 80%); }
.qz-design .mvn .sprite { position: absolute; bottom: 30px; right: 14px; width: 34px; height: 62px; background: linear-gradient(var(--d-char), var(--rose-deep)); }
.qz-design .mvn .box { position: absolute; left: 6px; right: 6px; bottom: 6px; background: var(--panel); box-shadow: 0 0 0 1px var(--seam); padding: 5px 7px; }
.qz-design .mvn .box b { display: block; font: 700 7px var(--f-mono); color: var(--d-char); text-transform: uppercase; margin-bottom: 2px; }
.qz-design .mvn .box p { margin: 0; font: 7.5px/1.3 var(--f-body); color: var(--paper); }
.qz-design .mplay { padding: 7px; font: 7.5px/1.5 var(--f-mono); color: var(--soft); height: 100%; overflow: hidden; }
.qz-design .mplay .who { color: var(--d-char); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; margin-top: 5px; }
.qz-design .mplay .who:first-child { margin-top: 0; }

/* ---- side panels: rail, drawer, overlay ---- */
.qz-design .mrail { position: absolute; top: 0; right: 0; bottom: 0; width: 42%; background: var(--panel); box-shadow: -1px 0 0 var(--seam); padding: 6px; overflow: hidden; }
.qz-design .mrail h4, .qz-design .mdrawer h4, .qz-design .mmodal h4 { margin: 0 0 5px; font: 700 7.5px var(--f-mono); text-transform: uppercase; color: var(--mute); letter-spacing: .04em; }
.qz-design .mdrawer { position: absolute; top: 0; bottom: 0; right: 0; width: 58%; background: var(--panel); box-shadow: -3px 0 10px rgba(0,0,0,.45); padding: 6px; }
.qz-design .mmodal { position: absolute; inset: 8% 6%; background: var(--panel); box-shadow: 0 0 0 2px var(--seam); padding: 7px; }

/* ---- HUD readout strip ---- */
.qz-design .mstrip { display: flex; align-items: center; gap: 9px; padding: 4px 7px; background: var(--deck); box-shadow: inset 0 -1px 0 var(--seam); font: 600 6.5px var(--f-mono); color: var(--mute); flex: none; }
.qz-design .mstrip b { color: var(--paper); }
.qz-design .mstrip .bar { width: 36px; height: 5px; background: var(--row); position: relative; flex: none; }
.qz-design .mstrip .bar i { position: absolute; inset: 0 auto 0 0; background: var(--mint); width: 64%; }

/* ---- forms, tabs, two-pane editors ---- */
.qz-design .mfield { margin-bottom: 5px; }
.qz-design .mfield label { display: block; font: 600 6px var(--f-mono); text-transform: uppercase; color: var(--mute); margin-bottom: 2px; letter-spacing: .04em; }
.qz-design .mfield .in { background: var(--row); box-shadow: inset 0 0 0 1px var(--line); padding: 4px 5px; font: 7.5px var(--f-body); color: var(--paper); }
.qz-design .metabs { display: flex; gap: 2px; margin-bottom: 6px; flex: none; }
.qz-design .metabs span { font: 600 6.5px var(--f-mono); text-transform: uppercase; padding: 3px 7px; background: var(--row); color: var(--mute); }
.qz-design .metabs span.on { background: var(--rose); color: var(--ink); }
.qz-design .mtwopane { display: flex; height: 100%; gap: 4px; }
.qz-design .mtwopane .pane { flex: 1; min-width: 0; background: var(--panel); box-shadow: 0 0 0 1px var(--seam); padding: 6px; overflow: hidden; }
.qz-design .mtwopane .pane.narrow { flex: .6; }

/* ---- preset blocks ---- */
.qz-design .mblock { display: flex; align-items: center; gap: 5px; padding: 4px 6px; background: var(--row); box-shadow: inset 0 -1px 0 var(--seam); }
.qz-design .mblock .sq { width: 7px; height: 7px; background: var(--mint); flex: none; }
.qz-design .mblock span.lbl { font: 500 7px var(--f-body); color: var(--soft); flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

/* ---- toasts, dialogs, badges ---- */
.qz-design .mtoast { position: absolute; right: 7px; bottom: 7px; background: var(--panel); box-shadow: 0 0 0 1px var(--seam); padding: 6px 9px; font: 7.5px var(--f-body); max-width: 70%; }
.qz-design .mtoast b { color: var(--mint); }
.qz-design .mdialog { position: absolute; inset: 0; background: rgba(10,8,13,.65); display: flex; align-items: center; justify-content: center; }
.qz-design .mdialog .box { background: var(--panel); box-shadow: 0 0 0 2px var(--seam); border-top: 3px solid #ff3b4f; padding: 9px 11px; width: 72%; }
.qz-design .mdialog .box p { margin: 5px 0 0; font: 7px/1.4 var(--f-body); color: var(--soft); }
.qz-design .mdialog .box .row { margin-top: 8px; display: flex; justify-content: flex-end; gap: 5px; }
.qz-design .mbadge { position: absolute; top: -2px; right: -2px; width: 6px; height: 6px; background: var(--rose); }

/* ---- wizard dots ---- */
.qz-design .mdots { display: flex; gap: 4px; justify-content: center; padding: 6px 0; flex: none; }
.qz-design .mdots span { width: 5px; height: 5px; background: var(--line); }
.qz-design .mdots span.on { background: var(--rose); }

/* ---- Kit terminal ---- */
.qz-design .mterm { background: var(--well); box-shadow: inset 0 0 0 1px var(--seam); padding: 6px 7px; font: 7.5px/1.6 var(--f-mono); color: var(--mint); height: 100%; overflow: hidden; }
.qz-design .mterm .pr { color: var(--d-char); margin-right: 5px; }
.qz-design .mterm .dim { color: var(--mute); }
.qz-design .mfloat { position: absolute; right: 8px; bottom: 8px; width: 62%; background: var(--panel); box-shadow: 0 5px 0 0 rgba(0,0,0,.55), 0 0 0 1px var(--seam); }
.qz-design .mfloat .bar { display: flex; align-items: center; justify-content: space-between; padding: 3px 6px; background: var(--deck); font: 600 6.5px var(--f-mono); color: var(--mute); text-transform: uppercase; }

/* ---- phone frame ---- */
.qz-design .mphone { width: 92px; margin: 0 auto; height: 100%; background: var(--well); box-shadow: 0 0 0 2px var(--seam); position: relative; overflow: hidden; display: flex; flex-direction: column; }

/* ---- theme picker ---- */
.qz-design .mtheme { width: 42px; height: 52px; flex: none; box-shadow: 0 0 0 1px var(--seam); position: relative; }
.qz-design .mtheme.on { box-shadow: 0 0 0 2px var(--rose); }
.qz-design .mtheme b { position: absolute; left: 2px; bottom: 2px; font: 700 6px var(--f-mono); color: var(--ink); background: rgba(255,255,255,.85); padding: 0 2px; }
`,
qs: [

{ id: "nav", t: "Main navigation", kind: "one", o: [
["dock", "Left dock", "Open and labeled, like today",
`<div class="scr"><nav class="mdock">
  <div class="mi on"><i></i><b>Scenes</b></div><div class="mi"><i></i><b>Workbench</b></div><div class="mi"><i></i><b>Library</b></div><div class="mi"><i></i><b>Press</b></div><div class="mi"><i></i><b>Kit</b></div>
</nav><div class="mbody"><div class="mpad"><div class="mrow" style="--t:var(--d-char)"><span class="av">V</span><span class="tx"><b>The long storm</b><small>Vera Lune, 2h ago</small></span></div></div></div></div>`],
["dockicons", "Dock, collapsed to icons", "Narrow rail, more room for the stage",
`<div class="scr"><nav class="mdock icons">
  <div class="mi on"><i></i></div><div class="mi"><i></i></div><div class="mi"><i></i></div><div class="mi"><i></i></div><div class="mi"><i></i></div>
</nav><div class="mbody"><div class="mpad"><div class="mrow" style="--t:var(--d-char)"><span class="av">V</span><span class="tx"><b>The long storm</b><small>Vera Lune, 2h ago</small></span></div></div></div></div>`],
["topbar", "Top bar", "Tabs across the top, no dock at all",
`<div class="scr col"><div class="mtop"><span class="mt on">Scenes</span><span class="mt">Workbench</span><span class="mt">Library</span><span class="mt">Press</span><span class="mt">Kit</span></div><div class="mbody"><div class="mpad"><div class="mrow" style="--t:var(--d-char)"><span class="av">V</span><span class="tx"><b>The long storm</b><small>Vera Lune, 2h ago</small></span></div></div></div></div>`],
["hudbar", "Bottom HUD bar", "Game-style action bar along the bottom",
`<div class="scr col"><div class="mbody"><div class="mpad"><div class="mrow" style="--t:var(--d-char)"><span class="av">V</span><span class="tx"><b>The long storm</b><small>Vera Lune, 2h ago</small></span></div></div><div class="mhud"><div class="mi on"><i></i><b>Play</b></div><div class="mi"><i></i><b>Make</b></div><div class="mi"><i></i><b>Keep</b></div><div class="mi"><i></i><b>Kit</b></div></div></div></div>`]]},

{ id: "landing", t: "What launch shows", kind: "one", o: [
["attract", "Attract title screen", "Press any key, then land wherever you pick",
`<div class="scr col" style="align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--d-lore) 18%, transparent), var(--well) 70%)"><div style="width:28px;height:28px;background:var(--rose);margin-bottom:8px"></div><div style="font:800 15px var(--f-title);letter-spacing:.06em">bunzai</div><div style="font:600 7px var(--f-mono);letter-spacing:.2em;color:var(--mute);margin-top:3px">A LITTLE THEATER</div><div style="font:600 8px var(--f-big);color:var(--paper);margin-top:14px;opacity:.8">press any key</div></div>`],
["lastscene", "Your last scene", "Straight into The long storm with Vera Lune",
`<div class="scr col"><div class="mbody"><div class="mchat" style="padding:7px"><div class="mbub them">*She strikes the match, cupping the flame against the wind.*</div><div class="mbub you">Deal. Just don't let it go out this time.</div></div></div></div>`],
["library", "Library", "Straight into your shelves",
`<div class="scr col"><div class="mpad"><div class="mgrid">
  <div class="mcard med" style="--t:var(--d-char)"><div class="ov"><b>Vera Lune</b></div></div>
  <div class="mcard med" style="--t:var(--d-lore)"><div class="ov"><b>Harbor Town</b><small>213 entries</small></div></div>
  <div class="mcard med" style="--t:var(--d-persona)"><div class="ov"><b>Nuit</b></div></div>
</div></div></div>`],
["home", "Home dashboard", "Recent scenes, news and stats in one glance",
`<div class="scr tall col"><div class="mpad">
  <div style="display:flex;gap:6px;margin-bottom:7px"><div class="chip">7 Scenes</div><div class="chip">5 Cast</div><div class="chip">18 Lorebooks</div></div>
  <div class="mrow" style="--t:var(--d-char)"><span class="av">V</span><span class="tx"><b>The long storm</b><small>2h ago</small></span></div>
  <div class="mrow" style="--t:var(--d-lore)"><span class="av">M</span><span class="tx"><b>The lock gave on the third try</b><small>6d ago</small></span></div>
  <div style="margin-top:6px;font:600 6.5px var(--f-mono);color:var(--mute);text-transform:uppercase">What's new: Props wing, group scenes</div>
</div></div>`]]},

{ id: "librarydensity", t: "Library grid density", kind: "one", o: [
["big", "Big portraits", "Fewer per row, art does the talking",
`<div class="scr"><div class="mpad"><div class="mgrid">
  <div class="mcard big" style="--t:var(--d-char)"><div class="ov"><b>Vera Lune</b><small>12 scenes</small></div></div>
  <div class="mcard big" style="--t:var(--d-persona)"><div class="ov"><b>Nuit</b><small>4 scenes</small></div></div>
</div></div></div>`],
["medium", "Medium", "Today's size, a solid middle ground",
`<div class="scr"><div class="mpad"><div class="mgrid">
  <div class="mcard med" style="--t:var(--d-char)"><div class="ov"><b>Vera Lune</b></div></div>
  <div class="mcard med" style="--t:var(--d-persona)"><div class="ov"><b>Nuit</b></div></div>
  <div class="mcard med" style="--t:var(--d-lore)"><div class="ov"><b>The Magpie</b></div></div>
  <div class="mcard med" style="--t:var(--d-pack)"><div class="ov"><b>Marguerite</b></div></div>
</div></div></div>`],
["compact", "Compact list", "Dense rows, scan names fast",
`<div class="scr col"><div class="mrow" style="--t:var(--d-char)"><span class="av">V</span><span class="tx"><b>Vera Lune</b><small>12 scenes</small></span></div>
<div class="mrow" style="--t:var(--d-persona)"><span class="av">N</span><span class="tx"><b>Nuit</b><small>4 scenes</small></span></div>
<div class="mrow" style="--t:var(--d-lore)"><span class="av">M</span><span class="tx"><b>The Magpie</b><small>3 scenes</small></span></div>
<div class="mrow" style="--t:var(--d-pack)"><span class="av">M</span><span class="tx"><b>Marguerite Vane</b><small>6 scenes</small></span></div>
<div class="mrow" style="--t:var(--d-preset)"><span class="av">C</span><span class="tx"><b>Corvin Ashe</b><small>2 scenes</small></span></div></div>`]]},

{ id: "libraryfilters", t: "Library filters placement", kind: "one", o: [
["rail", "Left rail of decks", "Click a deck to filter, like today",
`<div class="scr"><nav class="mdock" style="width:50px"><div class="mi on"><i></i><b>Chars</b></div><div class="mi"><i></i><b>Lore</b></div><div class="mi"><i></i><b>Preset</b></div></nav><div class="mbody"><div class="mpad"><div class="mgrid"><div class="mcard med" style="--t:var(--d-char)"><div class="ov"><b>Vera Lune</b></div></div><div class="mcard med" style="--t:var(--d-char)"><div class="ov"><b>Corvin Ashe</b></div></div></div></div></div></div>`],
["topbar", "Top bar chips", "Filter chips sit above the grid",
`<div class="scr col"><div class="mtop" style="gap:4px"><span class="chip on">All</span><span class="chip">Characters</span><span class="chip">Lorebooks</span><span class="chip">Personas</span></div><div class="mbody"><div class="mpad"><div class="mgrid"><div class="mcard med" style="--t:var(--d-char)"><div class="ov"><b>Vera Lune</b></div></div><div class="mcard med" style="--t:var(--d-lore)"><div class="ov"><b>Harbor Town</b></div></div></div></div></div></div>`],
["drawer", "Filter drawer", "Tap Filter, it slides over the grid",
`<div class="scr"><div class="mbody"><div class="mpad"><div class="mgrid"><div class="mcard med" style="--t:var(--d-char)"><div class="ov"><b>Vera Lune</b></div></div></div></div><div class="mdrawer" style="width:48%"><h4>Filter</h4><div style="display:flex;align-items:center;gap:5px;margin-bottom:5px"><span class="msw on"><i></i></span><span style="font:500 7px var(--f-body)">Characters</span></div><div style="display:flex;align-items:center;gap:5px;margin-bottom:5px"><span class="msw"><i></i></span><span style="font:500 7px var(--f-body)">Lorebooks</span></div><div style="display:flex;align-items:center;gap:5px"><span class="msw"><i></i></span><span style="font:500 7px var(--f-body)">Personas</span></div></div></div></div>`]]},

{ id: "sceneslist", t: "Scenes list layout", kind: "one", o: [
["herosplit", "Hero and preview side by side (today)", "Continue card left, last messages right",
`<div class="scr"><div class="mhero"><div class="big" style="--t:var(--d-char)"><div><div style="font:600 7px var(--f-big)">The long storm</div><div style="font:500 6px var(--f-mono);color:var(--mute)">Vera Lune, Take 2</div></div></div><div class="prev"><div class="mbub them" style="max-width:100%">*She strikes the match.*</div><div class="mbub you" style="max-width:100%;align-self:flex-end">Don't let it go out.</div></div></div></div>`],
["gridfirst", "Grid first, no hero", "Straight to the save-file grid, nothing bigger",
`<div class="scr"><div class="mpad"><div class="mgrid">
  <div class="mcard med" style="--t:var(--d-char)"><div class="ov"><b>The long storm</b><small>Vera Lune</small></div></div>
  <div class="mcard med" style="--t:var(--d-persona)"><div class="ov"><b>Cut the deck</b><small>Nuit</small></div></div>
  <div class="mcard med" style="--t:var(--d-lore)"><div class="ov"><b>The lock gave</b><small>The Magpie</small></div></div>
</div></div></div>`],
["herobanner", "Full-width hero banner", "One big continue banner on top, grid below",
`<div class="scr col"><div class="mpad" style="height:100%"><div class="mbanner"><span class="av" style="--t:var(--d-char);width:26px;height:26px">V</span><div><div style="font:600 7.5px var(--f-big)">Continue: The long storm</div><div style="font:500 6px var(--f-mono);color:var(--mute)">Vera Lune, 2h ago</div></div></div><div class="mgrid"><div class="mcard med" style="--t:var(--d-persona)"><div class="ov"><b>Cut the deck</b></div></div><div class="mcard med" style="--t:var(--d-lore)"><div class="ov"><b>The lock gave</b></div></div></div></div></div>`],
["castfocus", "Cast rail, plain list", "Pick a character, see their scenes as a list",
`<div class="scr"><nav class="mdock icons">
  <div class="mi on"><i style="box-shadow:none;background:var(--d-char)"></i></div><div class="mi"><i style="box-shadow:none;background:var(--d-persona)"></i></div><div class="mi"><i style="box-shadow:none;background:var(--d-lore)"></i></div>
</nav><div class="mbody"><div class="mrow" style="--t:var(--d-char)"><span class="av">V</span><span class="tx"><b>The long storm</b><small>2h ago</small></span></div><div class="mrow" style="--t:var(--d-char)"><span class="av">V</span><span class="tx"><b>Who did you let up the stairs?</b><small>23d ago</small></span></div></div></div>`]]},

{ id: "scenepage", t: "Scene page layout", kind: "one", o: [
["centered", "Centered column", "Messages sit in a narrow, readable column",
`<div class="scr"><div class="mbody" style="display:flex;justify-content:center"><div style="width:60%;height:100%" class="mchat"><div class="mbub them" style="align-self:center;max-width:100%">*She strikes the match, cupping the flame against the wind.*</div><div class="mbub you" style="align-self:center;max-width:100%">Deal. Just don't let it go out this time.</div></div></div></div>`],
["wingside", "Wide, with a side wing pinned open", "Chat fills most of the width, one wing stays open",
`<div class="scr"><div class="mbody"><div class="mchat" style="padding:7px 60% 7px 7px"><div class="mbub them">*She strikes the match.*</div><div class="mbub you">Don't let it go out.</div></div><div class="mrail"><h4>Cast</h4><div class="mrow" style="--t:var(--d-char);background:none;box-shadow:none;padding:0"><span class="av">V</span><span class="tx"><b>Vera Lune</b><small>Smuggler, Harbor Town</small></span></div></div></div></div>`],
["vnstage", "Visual novel stage", "Full backdrop, a sprite, a textbox",
`<div class="scr"><div class="mvn"><div class="sprite"></div><div class="box"><b>Vera Lune</b><p>Deal. Just don't let it go out this time.</p></div></div></div>`]]},

{ id: "chatstyle", t: "Chat style", kind: "one", o: [
["bubbles", "Bubbles", "Chat-app style, you right, them left",
`<div class="scr"><div class="mbody"><div class="mchat" style="padding:7px"><div class="mbub them">The lock gave on the third try. It clicked open at last.</div><div class="mbub you">About time. Keep watch.</div></div></div></div>`],
["prose", "Novel prose", "Full-width text, no bubbles, just paragraphs",
`<div class="scr"><div class="mbody mprose" style="padding:9px"><p><b>Vera Lune</b> struck the match, cupping the flame against the wind. "Deal. Just don't let it go out this time," she said.</p><p>"About time," you answered, keeping watch on the stairs.</p></div></div>`],
["vn", "VN textbox and sprite", "Backdrop art, a character sprite, a bottom textbox",
`<div class="scr"><div class="mvn"><div class="sprite"></div><div class="box"><b>Vera Lune</b><p>Deal. Just don't let it go out this time.</p></div></div></div>`],
["screenplay", "Screenplay", "Names in caps, dialogue below",
`<div class="scr"><div class="mplay"><div class="who">Vera Lune</div><div>Deal. Just don't let it go out this time.</div><div class="who">You</div><div>About time. Keep watch on the stairs.</div></div></div>`]]},

{ id: "wingsopen", t: "Where the side panels (Prompting, World, Cast, Props) open", kind: "one", o: [
["rail", "Right rail, pinned open", "Always visible beside the chat",
`<div class="scr"><div class="mbody"><div class="mchat" style="padding:7px 44% 7px 7px"><div class="mbub them" style="max-width:100%">*She strikes the match.*</div></div><div class="mrail"><h4>World</h4><div style="font:600 7px var(--f-big);margin-bottom:2px">Harbor Town</div><div style="font:500 6px var(--f-mono);color:var(--mute)">tide, smuggling</div></div></div></div>`],
["drawer", "Slide-out drawer", "Tap a wing tab, it slides over the chat",
`<div class="scr"><div class="mbody"><div class="mchat" style="padding:7px"><div class="mbub them" style="max-width:100%">*She strikes the match.*</div></div><div class="mdrawer"><h4>Props</h4><div style="display:flex;align-items:center;gap:5px"><span class="chip" style="background:var(--d-pack);color:var(--ink)">T</span><span style="font:500 7px var(--f-body)">TrackHare</span><span class="msw on" style="margin-left:auto"><i></i></span></div></div></div></div>`],
["overlay", "Full overlay, its own screen", "Opens as a whole page over the scene",
`<div class="scr"><div class="mmodal"><h4>Cast</h4><div class="mrow" style="--t:var(--d-char);background:none;box-shadow:none;padding:0 0 6px"><span class="av">V</span><span class="tx"><b>Vera Lune</b><small>Smuggler, frozen at this scene's version</small></span></div><div class="mrow" style="--t:var(--d-persona);background:none;box-shadow:none;padding:0"><span class="av">Y</span><span class="tx"><b>You</b><small>Default persona</small></span></div></div></div>`]]},

{ id: "hudinfo", t: "Live info while playing (tokens, cost, lore fired)", kind: "one", o: [
["always", "Always-on HUD strip", "A thin strip up top, always visible",
`<div class="scr col"><div class="mstrip"><span>SCENE <b>42 msgs</b></span><span>LORE</span><span class="bar"><i></i></span><span><b>64%</b></span><span>COST <b>$0.02</b></span></div><div class="mbody"><div class="mchat" style="padding:7px"><div class="mbub them">*She strikes the match.*</div></div></div></div>`],
["hover", "On hover", "Hover a message to see what fired",
`<div class="scr"><div class="mbody"><div class="mchat" style="padding:7px"><div class="mbub them">*She strikes the match, cupping the flame.*</div></div><div class="mtoast" style="bottom:40%;right:30%">Fired: <b>Harbor Town, tide</b></div></div></div>`],
["key", "Press a key to toggle it", "Hidden until you ask for it",
`<div class="scr col"><div class="mbody"><div class="mchat" style="padding:7px"><div class="mbub them">*She strikes the match.*</div></div></div><div class="mhud"><span class="chip">Tab: Show info</span></div></div>`]]},

{ id: "chareditor", t: "Character editor layout", kind: "one", o: [
["longform", "One long form", "Everything on one scrolling page",
`<div class="scr tall col"><div class="mpad">
  <div class="mfield"><label>Name</label><div class="in">Vera Lune</div></div>
  <div class="mfield"><label>Tagline</label><div class="in">A smuggler who keeps her word</div></div>
  <div class="mfield"><label>Description</label><div class="in" style="height:28px">Weathered coat, quick hands, slower to trust...</div></div>
</div></div>`],
["tabbed", "Tabbed", "Identity, Personality, Scenario as tabs",
`<div class="scr col"><div class="metabs"><span class="on">Identity</span><span>Personality</span><span>Scenario</span></div><div class="mbody"><div class="mpad">
  <div class="mfield"><label>Name</label><div class="in">Vera Lune</div></div>
  <div class="mfield"><label>Age</label><div class="in">34</div></div>
</div></div></div>`],
["twopane", "Two-pane with a live preview", "Fields on the left, the card updates on the right",
`<div class="scr"><div class="mtwopane"><div class="pane">
  <div class="mfield"><label>Name</label><div class="in">Vera Lune</div></div>
  <div class="mfield"><label>Tagline</label><div class="in">A smuggler who keeps her word</div></div>
</div><div class="pane narrow" style="display:flex;align-items:flex-end"><div class="mcard med" style="--t:var(--d-char);width:100%"><div class="ov"><b>Vera Lune</b><small>A smuggler who keeps her word</small></div></div></div></div></div>`]]},

{ id: "preseteditor", t: "Preset editor layout", kind: "one", o: [
["blocklist", "Block list and rail (today)", "A left rail of prompts, the editor beside it",
`<div class="scr"><div class="mtwopane"><div class="pane narrow" style="padding:0;overflow:auto">
  <div class="mblock"><span class="sq"></span><span class="lbl">Main Prompt</span></div>
  <div class="mblock"><span class="sq" style="background:var(--line)"></span><span class="lbl">Scenario</span></div>
  <div class="mblock"><span class="sq"></span><span class="lbl">Jailbreak</span></div>
</div><div class="pane"><div class="mfield"><label>Main Prompt</label><div class="in" style="height:40px">You are {{char}}, a smuggler working the Harbor Town docks...</div></div></div></div></div>`],
["fullwidth", "Full-width blocks", "Each prompt stacks full width, drag to reorder",
`<div class="scr col"><div class="mpad">
  <div class="mblock" style="margin-bottom:4px"><span class="sq"></span><span class="lbl">Main Prompt</span><span class="chip">drag</span></div>
  <div class="mblock" style="margin-bottom:4px"><span class="sq"></span><span class="lbl">Scenario</span><span class="chip">drag</span></div>
  <div class="mblock"><span class="sq" style="background:var(--line)"></span><span class="lbl">Jailbreak</span><span class="chip">drag</span></div>
</div></div>`],
["cards", "Cards", "Each prompt is its own card in a grid",
`<div class="scr"><div class="mpad"><div class="mgrid">
  <div class="mcard med" style="--t:var(--mint);align-items:flex-start;justify-content:flex-start"><div class="ov" style="background:none"><b>Main Prompt</b><small>on</small></div></div>
  <div class="mcard med" style="--t:var(--gold);align-items:flex-start;justify-content:flex-start"><div class="ov" style="background:none"><b>Scenario</b><small>on</small></div></div>
</div></div></div>`]]},

{ id: "lorebookeditor", t: "Lorebook editor layout", kind: "one", o: [
["tocentry", "A list and one entry (today)", "Pick an entry on the left, it fills the page",
`<div class="scr"><div class="mtwopane"><div class="pane narrow" style="padding:0;overflow:auto">
  <div class="mrow" style="background:var(--row)"><span class="tx"><b>Tide schedule</b></span></div>
  <div class="mrow"><span class="tx"><b>Smuggling tunnels</b></span></div>
</div><div class="pane"><div style="font:700 7.5px var(--f-big);margin-bottom:4px">Tide schedule</div><div style="font:500 6px var(--f-mono);color:var(--mute);margin-bottom:4px">Keys: tide, harbor, moonrise</div><div class="in" style="height:34px">The harbor floods its lower docks twice a day...</div></div></div></div>`],
["flatlist", "Flat list, expands in place", "Every entry stacked, click to open it right there",
`<div class="scr col"><div class="mrow" style="background:var(--panel)"><span class="tx"><b>Tide schedule</b><small>tide, harbor, moonrise</small></span></div>
<div style="background:var(--row);padding:6px;box-shadow:inset 0 -1px 0 var(--seam)"><div class="in" style="height:26px">The harbor floods its lower docks twice a day...</div></div>
<div class="mrow"><span class="tx"><b>Smuggling tunnels</b><small>tunnels, smuggling</small></span></div></div>`],
["cardgrid", "Card grid", "Entries as small cards, click one to open it",
`<div class="scr"><div class="mpad"><div class="mgrid">
  <div class="mcard med" style="--t:var(--d-lore)"><div class="ov"><b>Tide schedule</b><small>tide, harbor</small></div></div>
  <div class="mcard med" style="--t:var(--d-lore)"><div class="ov"><b>Smuggling tunnels</b><small>tunnels</small></div></div>
  <div class="mcard med" style="--t:var(--d-lore)"><div class="ov"><b>Velvet Quill</b><small>debts</small></div></div>
</div></div></div>`]]},

{ id: "settingsshape", t: "Settings shape", kind: "one", o: [
["onepage", "One searchable page", "Search up top, every setting below it",
`<div class="scr col"><div class="mpad">
  <div class="in" style="margin-bottom:6px">Search settings...</div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0"><span style="font:500 7.5px var(--f-body)">Autosave</span><span class="msw on"><i></i></span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0"><span style="font:500 7.5px var(--f-body)">Sound</span><span class="msw"><i></i></span></div>
</div></div>`],
["tabbed", "Tabbed by area", "Sections across the top",
`<div class="scr col"><div class="metabs"><span class="on">General</span><span>Providers</span><span>Privacy</span></div><div class="mbody"><div class="mpad">
  <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0"><span style="font:500 7.5px var(--f-body)">Autosave</span><span class="msw on"><i></i></span></div>
</div></div></div>`],
["gamemenu", "Game options menu", "Pause-menu style, sliders and toggles",
`<div class="scr col" style="background:radial-gradient(ellipse at 50% 20%, color-mix(in srgb, var(--d-preset) 14%, transparent), var(--well))"><div class="mpad" style="text-align:center">
  <div style="font:800 10px var(--f-title);letter-spacing:.08em;margin-bottom:8px">OPTIONS</div>
  <div style="display:flex;justify-content:space-between;padding:3px 10px"><span style="font:600 7px var(--f-mono);text-transform:uppercase">Music</span><span class="bar" style="width:50px"><i style="width:50%"></i></span></div>
  <div style="display:flex;justify-content:space-between;padding:3px 10px"><span style="font:600 7px var(--f-mono);text-transform:uppercase">Reduced motion</span><span class="msw"><i></i></span></div>
</div></div>`]]},

{ id: "deletepattern", t: "Delete pattern", kind: "one", o: [
["undo", "Just do it, offer Undo", "A toast appears for a few seconds",
`<div class="scr"><div class="mpad"><div class="mrow" style="--t:var(--d-persona);opacity:.4"><span class="av">N</span><span class="tx"><b style="text-decoration:line-through">Cut the deck</b></span></div></div><div class="mtoast"><b>Deleted.</b> Cut the deck <span style="text-decoration:underline">Undo</span></div></div>`],
["confirm", "Ask first", "A confirm dialog, every time",
`<div class="scr"><div class="mdialog"><div class="box"><div style="font:700 8px var(--f-big)">Cut this story?</div><p>"Cut the deck" and every message in it, permanently.</p><div class="row"><span class="mbtn ghost">Cancel</span><span class="mbtn danger">Delete</span></div></div></div></div>`],
["trashonly", "Straight to Trash, no prompt", "No dialog at all, recoverable for 3 days",
`<div class="scr col"><div class="mpad">
  <div class="mrow" style="--t:var(--d-char)"><span class="av">V</span><span class="tx"><b>The long storm</b><small>2h ago</small></span></div>
</div><div class="mstrip" style="justify-content:flex-end"><span class="chip">Trash: 1 item, 3 days left</span></div></div>`]]},

{ id: "importflow", t: "Import flow shape", kind: "one", o: [
["onescreen", "One screen", "Drop files, read the receipt, done",
`<div class="scr col"><div class="mpad">
  <div style="height:40px;box-shadow:inset 0 0 0 2px var(--line);display:flex;align-items:center;justify-content:center;font:600 7px var(--f-mono);color:var(--mute);text-transform:uppercase;margin-bottom:6px">Drop files here</div>
  <div style="font:500 7px var(--f-body);color:var(--soft)">We read Velvet Quill's Ledger from RoleCall and kept its 54 entries.</div>
</div></div>`],
["wizard", "Step wizard", "A few short screens, one question each",
`<div class="scr col"><div class="mpad" style="text-align:center;flex:1;display:flex;flex-direction:column;justify-content:center"><div style="font:600 7px var(--f-mono);color:var(--mute);text-transform:uppercase;margin-bottom:4px">Step 2 of 4</div><div style="font:700 8px var(--f-big);margin-bottom:6px">Where should this book live?</div><div class="mbtn" style="margin:0 auto">New Lorebook</div></div><div class="mdots"><span class="on"></span><span class="on"></span><span></span><span></span></div></div>`],
["savehud", "Save-transfer HUD", "A loading screen like a game's save file",
`<div class="scr col" style="align-items:center;justify-content:center;background:var(--well)"><div style="font:700 8px var(--f-mono);text-transform:uppercase;letter-spacing:.1em;color:var(--mint);margin-bottom:6px">SAVING...</div><div class="bar" style="width:90px;height:7px;margin-bottom:5px"><i style="width:72%"></i></div><div style="font:500 6.5px var(--f-mono);color:var(--mute)">Harbor Town imported, 213 entries</div></div>`]]},

{ id: "kitwindow", t: "Kit agent window", kind: "one", o: [
["floating", "Floating window", "A small window you can drag, over whatever you're doing",
`<div class="scr"><div class="mbody"><div class="mpad"><div class="mgrid"><div class="mcard med" style="--t:var(--d-char)"><div class="ov"><b>Vera Lune</b></div></div></div></div><div class="mfloat"><div class="bar"><span>Kit</span><span>x</span></div><div class="mterm" style="height:48px"><span class="pr">&gt;</span>bunzai scene export --last</div></div></div></div>`],
["docked", "Docked panel", "Pinned to one side, always there",
`<div class="scr"><div class="mbody"><div class="mpad"><div class="mgrid"><div class="mcard med" style="--t:var(--d-char)"><div class="ov"><b>Vera Lune</b></div></div></div></div><div class="mrail" style="width:48%;padding:0"><div class="mterm" style="height:100%"><span class="pr">&gt;</span>bunzai scene export --last<br><span class="dim">wrote the-long-storm.json</span></div></div></div></div>`],
["fullpage", "Full page", "Its own app, like Scenes or Library",
`<div class="scr"><nav class="mdock icons"><div class="mi"><i></i></div><div class="mi on"><i></i></div></nav><div class="mbody"><div class="mterm" style="height:100%;padding:8px"><span class="pr">&gt;</span>bunzai scene export --last<br><span class="dim">wrote the-long-storm.json</span><br><br><span class="pr">&gt;</span></div></div></div>`]]},

{ id: "mobilescene", t: "Mobile layout of the scene page", kind: "one", o: [
["sheet", "Bottom sheet for wings", "Wings slide up from the bottom over the chat",
`<div class="scr"><div class="mphone"><div class="mchat" style="flex:1;padding:5px"><div class="mbub them" style="max-width:85%">*She strikes the match.*</div></div><div style="background:var(--panel);box-shadow:inset 0 1px 0 var(--seam);padding:5px"><div style="width:18px;height:3px;background:var(--line);margin:0 auto 4px"></div><div style="font:600 6px var(--f-mono);text-transform:uppercase;color:var(--mute)">Cast: Vera Lune</div></div></div></div>`],
["tabswitch", "Tab bar swaps chat and wings", "A row of tabs at the bottom",
`<div class="scr"><div class="mphone"><div class="mchat" style="flex:1;padding:5px"><div class="mbub them" style="max-width:85%">*She strikes the match.*</div></div><div style="display:flex;box-shadow:inset 0 1px 0 var(--seam)"><span class="mt on" style="flex:1;text-align:center">Chat</span><span class="mt" style="flex:1;text-align:center">Cast</span><span class="mt" style="flex:1;text-align:center">World</span></div></div></div>`],
["drawerphone", "Edge drawer", "Swipe from the edge to open a wing",
`<div class="scr"><div class="mphone"><div class="mchat" style="flex:1;padding:5px"><div class="mbub them" style="max-width:85%">*She strikes the match.*</div></div></div><div class="mdrawer" style="width:30%;padding:4px"><div style="font:600 6px var(--f-mono);text-transform:uppercase;color:var(--mute)">Cast</div><div class="av" style="--t:var(--d-char);width:16px;height:16px;margin-top:4px">V</div></div></div>`]]},

{ id: "notifyplace", t: "Where notifications appear", kind: "one", o: [
["toast", "Corner toast", "Pops up, fades on its own",
`<div class="scr"><div class="mbody"><div class="mpad"></div><div class="mtoast"><b>Model connected.</b> Ready to play Vera Lune.</div></div></div>`],
["ticker", "HUD ticker line", "Scrolls across a thin strip up top",
`<div class="scr col"><div class="mstrip" style="justify-content:flex-start"><span style="color:var(--mint)">Lore fired: Harbor Town, tide</span></div><div class="mbody"><div class="mpad"></div></div></div>`],
["badge", "A quiet badge", "A dot on the icon, open it when you want",
`<div class="scr"><nav class="mdock icons"><div class="mi on" style="position:relative"><i></i><span class="mbadge"></span></div><div class="mi"><i></i></div></nav><div class="mbody"><div class="mpad"></div></div></div>`]]},

{ id: "firstrun", t: "The first-run experience", kind: "one", o: [
["wizard", "Step wizard", "One plain question per screen: theme, first deck, publish",
`<div class="scr col" style="align-items:center;justify-content:center"><div style="font:600 7px var(--f-mono);color:var(--mute);text-transform:uppercase;margin-bottom:4px">1 of 3</div><div style="font:700 9px var(--f-big);margin-bottom:8px">Pick a look</div><div style="display:flex;gap:5px"><div class="mtheme on" style="background:var(--well)"></div><div class="mtheme" style="background:var(--panel)"></div></div><div class="mdots"><span class="on"></span><span></span><span></span></div></div>`],
["straightin", "Straight into Library", "No wizard, land on the two empty-state doors",
`<div class="scr col" style="align-items:center;justify-content:center"><div style="font:700 9px var(--f-big);margin-bottom:3px">The stage is empty</div><div style="font:500 6.5px var(--f-body);color:var(--mute);margin-bottom:8px">Nothing here yet</div><div style="display:flex;gap:6px"><span class="mbtn">Import a card</span><span class="mbtn ghost">New scene</span></div></div>`],
["guidedtour", "Guided tour overlay", "Land in the app, tooltips point things out",
`<div class="scr"><nav class="mdock icons"><div class="mi on" style="position:relative;box-shadow:0 0 0 1px var(--rose)"><i></i></div><div class="mi"><i></i></div></nav><div class="mbody"><div class="mpad"></div><div class="mtoast" style="left:34px;right:auto;top:14px;bottom:auto">This is <b>Scenes</b>. Play with your cast here.</div></div></div>`]]},

{ id: "themepicker", t: "The theme picker", kind: "one", o: [
["cards", "Theme cards", "A grid of small screenshots to pick from",
`<div class="scr col"><div class="mpad"><div style="display:flex;gap:6px"><div class="mtheme on" style="background:linear-gradient(165deg,var(--panel),var(--well))"><b>Stage</b></div><div class="mtheme" style="background:linear-gradient(165deg,#f2e6ea,#d8c6cf)"><b>Paper</b></div><div class="mtheme" style="background:linear-gradient(165deg,var(--d-lore),var(--well))"><b>Arcade</b></div></div></div></div>`],
["list", "List with swatches", "Name and a few color dots per row",
`<div class="scr col"><div class="mrow"><span class="tx"><b>Stage</b></span><span style="display:flex;gap:3px"><span style="width:8px;height:8px;background:var(--well)"></span><span style="width:8px;height:8px;background:var(--rose)"></span></span></div>
<div class="mrow"><span class="tx"><b>Paper</b></span><span style="display:flex;gap:3px"><span style="width:8px;height:8px;background:#f2e6ea"></span><span style="width:8px;height:8px;background:#c7495f"></span></span></div></div>`],
["carousel", "Live preview carousel", "A full preview, arrows to flip through live",
`<div class="scr col"><div class="mbody"><div class="mpad"><div class="mrow" style="--t:var(--d-char)"><span class="av">V</span><span class="tx"><b>The long storm</b><small>Vera Lune</small></span></div></div></div><div style="display:flex;justify-content:center;align-items:center;gap:10px;padding:4px"><span class="mbtn ghost">&lsaquo;</span><span style="font:600 7px var(--f-mono);text-transform:uppercase">Stage</span><span class="mbtn ghost">&rsaquo;</span></div></div>`]]}

]
};
