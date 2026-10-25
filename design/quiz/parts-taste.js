window.QUIZ_PARTS = window.QUIZ_PARTS || {};
window.QUIZ_PARTS["taste"] = {
label: "Taste",
title: "What looks right, for real",
intro: "Every option below is an actual drawn mockup, not a color swatch. Tap the one that looks right to you. Where it says pick more than one, you can, and top pick first.",
css: `
.qz-taste{--qzt-red:#ff3b4f}
.qz-taste *{box-sizing:border-box}
.qz-taste button{font-family:inherit;cursor:pointer}
.qz-taste .mk{width:100%;height:100%;min-height:140px;display:flex;align-items:center;justify-content:center;background:var(--well);padding:12px;overflow:hidden}
.qz-taste .mk *{border-radius:0}
.qz-taste .mk.col{flex-direction:column;gap:10px}
.qz-taste .mk.stack{flex-direction:column;align-items:stretch;justify-content:center;gap:8px}
.qz-taste .mk.left{justify-content:flex-start}
.qz-taste .qzt-bar{position:relative;height:8px;background:var(--row);box-shadow:inset 0 0 0 1px var(--seam);overflow:hidden}
.qz-taste .qzt-bar i{display:block;height:100%}

/* 1. primary button */
.qz-taste .qzt-btnp-a{background:var(--rose);color:var(--floor);border:0;padding:12px 22px;font:700 14px var(--f-body)}
.qz-taste .qzt-btnp-b{background:transparent;color:var(--rose);border:2px solid var(--rose);padding:10px 20px;font:700 12px var(--f-mono);letter-spacing:.14em}
.qz-taste .qzt-btnp-c{background:var(--panel);color:var(--paper);border:4px double var(--soft);padding:9px 22px;font:700 15px var(--f-body);box-shadow:inset 0 0 0 1px var(--well)}
.qz-taste .qzt-btnp-d{background:none;color:var(--paper);border:0;padding:10px 2px;font:700 15px var(--f-body);position:relative}
.qz-taste .qzt-btnp-d::after{content:"";position:absolute;left:0;right:0;bottom:4px;height:3px;background:var(--rose)}

/* 2. secondary / ghost button */
.qz-taste .qzt-btns-a{background:transparent;color:var(--soft);border:2px solid var(--line);padding:10px 20px;font:700 13px var(--f-body)}
.qz-taste .qzt-btns-b{background:rgba(245,236,240,.08);color:var(--paper);border:0;padding:10px 20px;font:600 13px var(--f-body)}
.qz-taste .qzt-btns-c{position:relative;background:transparent;color:var(--mute);border:0;padding:10px 18px;font:700 11px var(--f-mono);letter-spacing:.12em}
.qz-taste .qzt-btns-c::before{content:"";position:absolute;inset:0;background-repeat:no-repeat;background-image:linear-gradient(var(--line),var(--line)),linear-gradient(var(--line),var(--line)),linear-gradient(var(--line),var(--line)),linear-gradient(var(--line),var(--line));background-size:10px 2px,2px 10px,10px 2px,2px 10px;background-position:top left,top left,bottom right,bottom right}

/* 3. send button */
.qz-taste .qzt-send-a{background:var(--rose);color:var(--floor);border:0;width:42px;height:42px;display:flex;align-items:center;justify-content:center}
.qz-taste .qzt-send-b{display:inline-flex;align-items:center;gap:8px;padding:7px 12px 7px 7px;background:var(--row);box-shadow:inset 0 0 0 1px var(--line);color:var(--soft);font:600 13px var(--f-body)}
.qz-taste .qzt-send-b kbd{font:700 12px var(--f-mono);padding:3px 7px;color:var(--rose);background:var(--well);box-shadow:inset 0 0 0 1px var(--rose)}
.qz-taste .qzt-send-c{background:var(--rose);color:var(--floor);border:0;padding:10px 16px;display:inline-flex;align-items:center;gap:8px;font:700 14px var(--f-body)}
.qz-taste .qzt-send-d{background:rgba(255,95,160,.16);color:var(--rose);border:0;width:42px;height:42px;display:flex;align-items:center;justify-content:center}

/* 4. toggle switch */
.qz-taste .qzt-row{display:flex;align-items:center;gap:10px}
.qz-taste .qzt-sw-a{position:relative;display:inline-block;width:34px;height:18px;background:var(--line);flex:none}
.qz-taste .qzt-sw-a::after{content:"";position:absolute;top:3px;left:3px;width:12px;height:12px;background:var(--paper)}
.qz-taste .qzt-sw-a.on{background:var(--rose)}
.qz-taste .qzt-sw-a.on::after{left:19px;background:var(--floor)}
.qz-taste .qzt-sw-label{font:400 13px var(--f-body);color:var(--paper)}
.qz-taste .qzt-seg{display:inline-flex}
.qz-taste .qzt-seg button{background:var(--row);color:var(--mute);border:1px solid var(--line);padding:7px 14px;font:700 11px var(--f-mono);letter-spacing:.1em}
.qz-taste .qzt-seg button.on{background:var(--rose);color:var(--floor);border-color:var(--rose)}
.qz-taste .qzt-lever{position:relative;display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--well)}
.qz-taste .qzt-lever::before{content:"";position:absolute;inset:0;background-repeat:no-repeat;background-image:linear-gradient(var(--mute),var(--mute)),linear-gradient(var(--mute),var(--mute)),linear-gradient(var(--mute),var(--mute)),linear-gradient(var(--mute),var(--mute));background-size:9px 2px,2px 9px,9px 2px,2px 9px;background-position:top left,top left,bottom right,bottom right}
.qz-taste .qzt-lever .track{position:relative;width:40px;height:14px;background:var(--row);flex:none}
.qz-taste .qzt-lever .track i{display:block;height:100%;width:0;background:var(--mute)}
.qz-taste .qzt-lever.on .track i{width:100%;background:var(--rose)}
.qz-taste .qzt-lever .txt{font:700 11px var(--f-mono);letter-spacing:.08em;color:var(--mute)}
.qz-taste .qzt-lever .txt b{color:var(--paper)}
.qz-taste .qzt-lever.on .txt b{color:var(--rose)}

/* 5. checkbox */
.qz-taste .qzt-cb-row{display:flex;align-items:center;gap:10px;font:400 14px var(--f-body);color:var(--paper)}
.qz-taste .qzt-cb-a{width:18px;height:18px;flex:none;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--floor)}
.qz-taste .qzt-cb-a.checked{background:var(--rose);border-color:var(--rose)}
.qz-taste .qzt-rowsel{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:9px 12px;background:var(--row);color:var(--paper);font:400 14px var(--f-body)}
.qz-taste .qzt-rowsel.checked{background:#2d1a2a;box-shadow:inset 3px 0 0 var(--rose);color:var(--rose)}
.qz-taste .qzt-cb-c{width:22px;height:22px;flex:none;border:3px solid var(--soft);display:flex;align-items:center;justify-content:center}
.qz-taste .qzt-cb-c.checked{border-color:var(--gold)}
.qz-taste .qzt-cb-c.checked::after{content:"";width:10px;height:10px;background:var(--gold)}

/* 6. chips / tags */
.qz-taste .qzt-chiprow{display:flex;gap:8px;flex-wrap:wrap}
.qz-taste .qzt-chip-a{display:inline-flex;align-items:center;padding:4px 10px;font:500 12px var(--f-mono);color:var(--c);background:color-mix(in srgb, var(--c) 16%, transparent)}
.qz-taste .qzt-chip-b{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;font:500 12px var(--f-mono);color:var(--soft);border:1px solid var(--line)}
.qz-taste .qzt-chip-b i{width:7px;height:7px;background:var(--c)}
.qz-taste .qzt-chip-c{font:500 13px var(--f-mono);color:var(--c)}
.qz-taste .qzt-chip-d{display:inline-flex;align-items:center;gap:7px;padding:4px 8px 4px 10px;font:600 12px var(--f-body);color:var(--floor);background:var(--c)}
.qz-taste .qzt-chip-d button{background:none;border:0;color:var(--floor);font:700 13px var(--f-body);line-height:1;padding:0}

/* 7. progress meter */
.qz-taste .qzt-mp-a{width:100%;display:flex;flex-direction:column;gap:6px}
.qz-taste .qzt-mp-a .row{display:flex;justify-content:space-between;font:500 11px var(--f-mono);color:var(--mute)}
.qz-taste .qzt-mp-a .qzt-bar i{background:var(--rose)}
.qz-taste .qzt-mp-b{width:100%;display:flex;flex-direction:column;gap:6px}
.qz-taste .qzt-mp-b .row{display:flex;justify-content:space-between;font:700 11px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.qz-taste .qzt-mp-b .qzt-bar{height:9px}
.qz-taste .qzt-mp-b .qzt-bar i{background:var(--rose)}
.qz-taste .qzt-mp-b .qzt-bar::after{content:"";position:absolute;inset:0;background-image:repeating-linear-gradient(to right,transparent 0 11px,var(--well) 11px 12px)}
.qz-taste .qzt-pips{display:flex;align-items:center;gap:10px}
.qz-taste .qzt-pips .dots{display:flex;gap:4px}
.qz-taste .qzt-pips .dots span{width:14px;height:6px;background:var(--line)}
.qz-taste .qzt-pips .dots span.on{background:var(--rose)}
.qz-taste .qzt-pips .lbl{font:600 12px var(--f-mono);color:var(--mute)}

/* 8. context fill meter */
.qz-taste .qzt-mc-a{width:100%;display:flex;flex-direction:column;gap:8px}
.qz-taste .qzt-mc-a .row{display:flex;justify-content:space-between;font:500 12px var(--f-mono);color:var(--mute)}
.qz-taste .qzt-mc-a .qzt-bar{height:10px}
.qz-taste .qzt-mc-a .qzt-bar i{background:linear-gradient(to right,var(--mint),var(--gold) 70%,var(--rose) 100%)}
.qz-taste .qzt-mc-b{text-align:center}
.qz-taste .qzt-mc-b b{display:block;font:700 32px var(--f-mono);color:var(--rose)}
.qz-taste .qzt-mc-b span{display:block;margin-top:4px;font:500 12px var(--f-mono);color:var(--mute)}
.qz-taste .qzt-mc-c{width:100%;display:flex;flex-direction:column;gap:8px}
.qz-taste .qzt-mc-c .qzt-bar{display:flex;height:10px}
.qz-taste .qzt-mc-c .qzt-bar i{height:100%}
.qz-taste .qzt-mc-c .legend{display:flex;gap:12px;font:500 11px var(--f-mono)}
.qz-taste .qzt-mc-c .legend span{display:flex;align-items:center;gap:5px;color:var(--mute)}
.qz-taste .qzt-mc-c .legend span::before{content:"";width:8px;height:8px;background:var(--c)}
.qz-taste .qzt-mc-d{display:flex;align-items:center;gap:14px}
.qz-taste .qzt-mc-d .gauge{position:relative;width:16px;height:90px;background:var(--row);box-shadow:inset 0 0 0 1px var(--seam);flex:none}
.qz-taste .qzt-mc-d .gauge i{position:absolute;left:0;right:0;bottom:0;background:var(--rose)}
.qz-taste .qzt-mc-d .txt b{display:block;font:700 20px var(--f-mono);color:var(--paper)}
.qz-taste .qzt-mc-d .txt span{display:block;margin-top:2px;font:500 11px var(--f-mono);color:var(--mute)}

/* 9. panel frame */
.qz-taste .qzt-pf-a{width:100%;padding:12px 14px;background:var(--panel);box-shadow:0 0 0 1px var(--seam);border-top:4px solid var(--rose)}
.qz-taste .qzt-pf-b{position:relative;width:100%;padding:14px 16px;background:var(--well)}
.qz-taste .qzt-pf-b::before{content:"";position:absolute;inset:0;background-repeat:no-repeat;background-image:linear-gradient(var(--rose),var(--rose)),linear-gradient(var(--rose),var(--rose)),linear-gradient(var(--rose),var(--rose)),linear-gradient(var(--rose),var(--rose)),linear-gradient(var(--rose),var(--rose)),linear-gradient(var(--rose),var(--rose)),linear-gradient(var(--rose),var(--rose)),linear-gradient(var(--rose),var(--rose));background-size:12px 2px,2px 12px,12px 2px,2px 12px,12px 2px,2px 12px,12px 2px,2px 12px;background-position:top left,top left,top right,top right,bottom left,bottom left,bottom right,bottom right}
.qz-taste .qzt-pf-c{width:100%;padding:12px 14px;background:var(--panel);border:4px double var(--soft)}
.qz-taste .qzt-pf-d{width:100%;background:var(--panel);box-shadow:0 0 0 2px var(--seam)}
.qz-taste .qzt-pf-d .hd{background:var(--rose);color:var(--floor);padding:7px 14px;font:700 13px var(--f-body)}
.qz-taste .qzt-pf-d p{padding:10px 14px;margin:0}
.qz-taste .qzt-pf-a b, .qz-taste .qzt-pf-b b, .qz-taste .qzt-pf-c b{display:block;font:700 15px var(--f-body);color:var(--paper)}
.qz-taste .qzt-pf-a p, .qz-taste .qzt-pf-b p, .qz-taste .qzt-pf-c p{margin:5px 0 0;font:400 13px var(--f-body);color:var(--mute)}

/* 10. section header */
.qz-taste .qzt-sh-a .kicker{display:block;font:500 11px var(--f-mono);letter-spacing:.18em;text-transform:uppercase;color:var(--mute)}
.qz-taste .qzt-sh-a h3{margin:5px 0 0;font:700 22px var(--f-title);letter-spacing:.03em;color:var(--paper)}
.qz-taste .qzt-sh-b{display:flex;align-items:center;gap:9px;font:500 12px var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.qz-taste .qzt-sh-b .sq{width:7px;height:7px;background:var(--rose)}
.qz-taste .qzt-sh-c{display:flex;align-items:center;justify-content:space-between;width:100%;padding:9px 14px;background:var(--row);box-shadow:inset 0 -2px 0 var(--rose)}
.qz-taste .qzt-sh-c span{font:700 15px var(--f-big);color:var(--paper)}
.qz-taste .qzt-sh-c b{font:700 13px var(--f-mono);color:var(--mute)}

/* 11. tabs */
.qz-taste .qzt-tabs-a{display:flex;gap:0;width:100%;box-shadow:inset 0 -1px 0 var(--seam)}
.qz-taste .qzt-tabs-a button{background:none;border:0;padding:9px 14px;font:600 13px var(--f-big);color:var(--mute);box-shadow:inset 0 -2px 0 transparent}
.qz-taste .qzt-tabs-a button.on{color:var(--paper);box-shadow:inset 0 -3px 0 var(--rose)}
.qz-taste .qzt-tabs-b{display:flex;gap:4px;width:100%}
.qz-taste .qzt-tabs-b button{background:var(--row);border:1px solid var(--line);color:var(--soft);padding:8px 14px;font:600 12px var(--f-mono);letter-spacing:.06em}
.qz-taste .qzt-tabs-b button.on{background:var(--rose);color:var(--floor);border-color:var(--rose)}
.qz-taste .qzt-tabs-c{display:flex;flex-direction:column;gap:2px;width:140px}
.qz-taste .qzt-tabs-c button{display:flex;align-items:center;background:none;border:0;color:var(--mute);padding:8px 10px;font:600 13px var(--f-body);box-shadow:inset 3px 0 0 transparent;text-align:left}
.qz-taste .qzt-tabs-c button.on{color:var(--paper);background:var(--row);box-shadow:inset 3px 0 0 var(--rose)}

/* 12. character card, Library */
.qz-taste .qzt-cc-a{width:120px;background:var(--panel);box-shadow:0 0 0 1px var(--seam)}
.qz-taste .qzt-cc-a .art{height:120px;display:flex;align-items:center;justify-content:center;font:italic 600 32px var(--f-big);color:var(--rose-deep);background:linear-gradient(165deg,var(--rose-deep),var(--panel) 85%)}
.qz-taste .qzt-cc-a b{display:block;padding:7px 8px;font:600 13px var(--f-big);color:var(--paper)}
.qz-taste .qzt-cc-b{width:130px;background:var(--panel);box-shadow:0 0 0 1px var(--seam)}
.qz-taste .qzt-cc-b .art{height:90px;display:flex;align-items:center;justify-content:center;font:italic 600 26px var(--f-big);color:var(--sky);background:var(--well)}
.qz-taste .qzt-cc-b .stats{display:flex;justify-content:space-between;padding:6px 8px;background:var(--row);font:600 10px var(--f-mono);color:var(--mute)}
.qz-taste .qzt-cc-b b{display:block;padding:6px 8px 2px;font:600 13px var(--f-big);color:var(--paper)}
.qz-taste .qzt-cc-c{display:flex;width:100%;background:var(--panel);box-shadow:0 0 0 1px var(--seam);border-left:6px solid var(--gold)}
.qz-taste .qzt-cc-c .body{padding:9px 10px}
.qz-taste .qzt-cc-c b{display:block;font:700 14px var(--f-big);color:var(--paper)}
.qz-taste .qzt-cc-c .lvl{display:block;margin-top:2px;font:700 11px var(--f-mono);color:var(--gold);text-transform:uppercase}
.qz-taste .qzt-cc-d{display:flex;align-items:center;gap:10px;width:100%;background:var(--row);padding:8px 10px}
.qz-taste .qzt-cc-d .av{width:34px;height:34px;flex:none;display:flex;align-items:center;justify-content:center;font:italic 600 15px var(--f-big);color:var(--floor);background:var(--mint)}
.qz-taste .qzt-cc-d b{display:block;font:600 13px var(--f-body);color:var(--paper)}
.qz-taste .qzt-cc-d span{display:block;margin-top:2px;font:400 11px var(--f-mono);color:var(--mute)}

/* 13. scene card */
.qz-taste .qzt-cs-a{position:relative;width:130px;height:170px;background:linear-gradient(165deg,var(--rose-deep),var(--panel) 85%);border-top:4px solid var(--rose)}
.qz-taste .qzt-cs-a .badge{position:absolute;top:7px;left:7px;padding:2px 6px;font:700 10px var(--f-mono);text-transform:uppercase;background:#123123;color:var(--mint)}
.qz-taste .qzt-cs-a .ov{position:absolute;left:0;right:0;bottom:0;padding:8px 9px;background:linear-gradient(transparent,rgba(14,11,20,.9) 55%)}
.qz-taste .qzt-cs-a .who{font:500 11px var(--f-body);color:var(--rose)}
.qz-taste .qzt-cs-a h4{margin:2px 0 0;font:600 13px var(--f-big);color:var(--paper)}
.qz-taste .qzt-cs-b{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;background:var(--row)}
.qz-taste .qzt-cs-b .av{width:36px;height:36px;flex:none;background:var(--rose-deep);display:flex;align-items:center;justify-content:center;font:italic 600 16px var(--f-big);color:var(--rose)}
.qz-taste .qzt-cs-b b{display:block;font:600 13px var(--f-big);color:var(--paper)}
.qz-taste .qzt-cs-b span{display:block;margin-top:1px;font:400 11px var(--f-body);color:var(--mute)}
.qz-taste .qzt-cs-b time{margin-left:auto;flex:none;font:500 11px var(--f-mono);color:var(--mute)}
.qz-taste .qzt-cs-c{width:100%;padding:12px 14px;background:var(--panel);box-shadow:0 0 0 1px var(--seam)}
.qz-taste .qzt-cs-c b{font:700 14px var(--f-big);color:var(--paper)}
.qz-taste .qzt-cs-c p{margin:4px 0 0;font:400 12.5px var(--f-body);color:var(--mute)}

/* 14. hero continue card */
.qz-taste .qzt-hero-a{position:relative;width:100%;height:200px;background:linear-gradient(165deg,var(--rose-deep),var(--panel) 85%);border-top:4px solid var(--rose)}
.qz-taste .qzt-hero-a .ov{position:absolute;left:0;right:0;bottom:0;padding:12px 14px;background:linear-gradient(transparent,rgba(14,11,20,.92) 50%)}
.qz-taste .qzt-hero-a h4{margin:0;font:700 17px var(--f-big);color:var(--paper)}
.qz-taste .qzt-hero-a .sub{margin-top:2px;font:400 12px var(--f-body);color:var(--soft)}
.qz-taste .qzt-hero-a .qzt-bar{margin-top:8px;height:6px}
.qz-taste .qzt-hero-a .qzt-bar i{background:var(--rose)}
.qz-taste .qzt-hero-a .go{display:inline-block;margin-top:9px;padding:7px 14px;background:var(--rose);color:var(--floor);font:700 12px var(--f-body)}
.qz-taste .qzt-hero-b{display:flex;align-items:center;gap:12px;width:100%;padding:10px;background:var(--panel);box-shadow:0 0 0 1px var(--seam)}
.qz-taste .qzt-hero-b .art{width:56px;height:56px;flex:none;background:linear-gradient(165deg,var(--rose-deep),var(--panel) 85%)}
.qz-taste .qzt-hero-b b{display:block;font:700 14px var(--f-big);color:var(--paper)}
.qz-taste .qzt-hero-b span{display:block;margin-top:2px;font:400 11px var(--f-body);color:var(--mute)}
.qz-taste .qzt-hero-b button{margin-left:auto;flex:none;background:var(--rose);color:var(--floor);border:0;padding:7px 12px;font:700 11px var(--f-body)}
.qz-taste .qzt-hero-c{width:100%;padding:14px 16px;background:var(--panel);box-shadow:0 0 0 1px var(--seam);border-left:4px solid var(--rose)}
.qz-taste .qzt-hero-c span{display:block;font:500 11px var(--f-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
.qz-taste .qzt-hero-c b{display:block;margin-top:3px;font:700 16px var(--f-big);color:var(--paper)}
.qz-taste .qzt-hero-c button{margin-top:9px;background:none;color:var(--rose);border:2px solid var(--rose);padding:7px 14px;font:700 12px var(--f-body)}

/* 15 / 16. chat messages */
.qz-taste .qzt-msg-a{display:flex;gap:8px;align-items:flex-end;width:100%}
.qz-taste .qzt-msg-a .av{width:28px;height:28px;flex:none;background:var(--rose-deep);color:var(--rose);display:flex;align-items:center;justify-content:center;font:italic 600 13px var(--f-big)}
.qz-taste .qzt-msg-a .bb{max-width:80%;padding:9px 12px;background:var(--panel);box-shadow:0 0 0 1px var(--seam)}
.qz-taste .qzt-msg-a .bb b{display:block;font:700 11px var(--f-mono);color:var(--rose);margin-bottom:3px}
.qz-taste .qzt-msg-a .bb p{margin:0;font:400 13.5px/1.5 var(--f-body);color:var(--paper)}
.qz-taste .qzt-msg-a.you{flex-direction:row-reverse}
.qz-taste .qzt-msg-a.you .av{background:var(--line);color:var(--paper)}
.qz-taste .qzt-msg-a.you .bb{background:#2a1a33;box-shadow:0 0 0 1px var(--rose-deep)}
.qz-taste .qzt-msg-a.you .bb b{color:var(--soft)}
.qz-taste .qzt-msg-b{width:100%}
.qz-taste .qzt-msg-b b{display:block;font:700 11px var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--rose)}
.qz-taste .qzt-msg-b p{margin:5px 0 0;font:400 15px/1.6 var(--f-body);color:var(--paper)}
.qz-taste .qzt-msg-b.you b{color:var(--soft)}
.qz-taste .qzt-msg-c{width:100%;text-align:left}
.qz-taste .qzt-msg-c b{display:block;font:700 13px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--rose)}
.qz-taste .qzt-msg-c p{margin:4px 0 0;font:400 14px/1.55 var(--f-body);color:var(--soft)}
.qz-taste .qzt-msg-c.you b{color:var(--mute)}
.qz-taste .qzt-msg-d{position:relative;width:100%;padding:12px 14px;background:var(--well);box-shadow:inset 0 0 0 1px var(--seam)}
.qz-taste .qzt-msg-d b{display:block;font:700 12px var(--f-mono);color:var(--rose)}
.qz-taste .qzt-msg-d p{margin:5px 0 0;font:400 13.5px/1.5 var(--f-body);color:var(--paper)}
.qz-taste .qzt-msgyou-b{width:72%;margin-left:auto;padding:8px 11px;background:var(--row);text-align:right}
.qz-taste .qzt-msgyou-b p{margin:0;font:400 13px/1.5 var(--f-body);color:var(--paper)}
.qz-taste .qzt-msgyou-c{width:100%}
.qz-taste .qzt-msgyou-c b{font:600 11px var(--f-mono);color:var(--mute)}
.qz-taste .qzt-msgyou-c p{margin:4px 0 0;font:400 13px/1.5 var(--f-body);color:var(--paper)}

/* 17. swipe controls */
.qz-taste .qzt-swipe-a{display:flex;align-items:center;gap:14px;font:700 13px var(--f-mono);color:var(--paper)}
.qz-taste .qzt-swipe-a button{background:none;border:1px solid var(--line);color:var(--soft);width:28px;height:28px}
.qz-taste .qzt-swipe-b{display:flex;flex-direction:column;align-items:center;gap:8px}
.qz-taste .qzt-swipe-b .dots{display:flex;gap:6px}
.qz-taste .qzt-swipe-b .dots span{width:7px;height:7px;background:var(--line)}
.qz-taste .qzt-swipe-b .dots span.on{background:var(--rose)}
.qz-taste .qzt-swipe-c{display:flex;align-items:center;gap:0;width:100%}
.qz-taste .qzt-swipe-c .peek{width:14%;height:70px;background:var(--row);opacity:.5}
.qz-taste .qzt-swipe-c .main{flex:1;height:80px;margin:0 6px;background:var(--panel);box-shadow:0 0 0 1px var(--seam);display:flex;align-items:center;justify-content:center;font:400 12px var(--f-body);color:var(--soft);text-align:center;padding:0 10px}
.qz-taste .qzt-swipe-d{display:flex;align-items:center;gap:10px}
.qz-taste .qzt-swipe-d .hud-key{display:inline-flex;align-items:center;gap:6px;padding:4px 9px 4px 5px;background:var(--row);box-shadow:inset 0 0 0 1px var(--line);font:600 11px var(--f-body);color:var(--soft)}
.qz-taste .qzt-swipe-d kbd{font:700 11px var(--f-mono);padding:2px 6px;color:var(--rose);background:var(--well);box-shadow:inset 0 0 0 1px var(--rose)}

/* 18. composer */
.qz-taste .qzt-comp-a{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;background:var(--row);box-shadow:inset 0 0 0 1px var(--seam)}
.qz-taste .qzt-comp-a .fake-input{flex:1;color:var(--mute);font:400 13px var(--f-body)}
.qz-taste .qzt-comp-a .ic{width:20px;height:20px;color:var(--mute)}
.qz-taste .qzt-comp-a .sendsq{width:32px;height:32px;flex:none;background:var(--rose);color:var(--floor);display:flex;align-items:center;justify-content:center}
.qz-taste .qzt-comp-b{display:flex;flex-direction:column;gap:7px;width:100%}
.qz-taste .qzt-comp-b .tools{display:flex;gap:8px}
.qz-taste .qzt-comp-b .tools span{width:26px;height:26px;background:var(--panel);color:var(--mute);display:flex;align-items:center;justify-content:center}
.qz-taste .qzt-comp-b .inrow{display:flex;align-items:center;gap:8px}
.qz-taste .qzt-comp-b .fake-input{flex:1;padding:9px 10px;background:var(--well);box-shadow:inset 0 0 0 1px var(--seam);color:var(--mute);font:400 13px var(--f-body)}
.qz-taste .qzt-comp-b button{background:var(--rose);color:var(--floor);border:0;padding:9px 14px;font:700 12px var(--f-body)}
.qz-taste .qzt-comp-c{position:relative;width:100%;padding:12px 14px;background:var(--well)}
.qz-taste .qzt-comp-c::before{content:"";position:absolute;inset:0;background-repeat:no-repeat;background-image:linear-gradient(var(--mute),var(--mute)),linear-gradient(var(--mute),var(--mute)),linear-gradient(var(--mute),var(--mute)),linear-gradient(var(--mute),var(--mute));background-size:10px 2px,2px 10px,10px 2px,2px 10px;background-position:top left,top left,bottom right,bottom right}
.qz-taste .qzt-comp-c .in{display:flex;align-items:center;gap:8px;color:var(--soft);font:400 13px var(--f-body)}
.qz-taste .qzt-comp-c .caret{color:var(--rose)}
.qz-taste .qzt-comp-c .hint{margin-top:8px;font:600 11px var(--f-mono);color:var(--mute)}
.qz-taste .qzt-comp-c .hint kbd{color:var(--rose);background:var(--row);padding:2px 6px;box-shadow:inset 0 0 0 1px var(--rose)}

/* 19. HUD info strip */
.qz-taste .qzt-hud-a{display:flex;align-items:center;gap:16px;width:100%;padding:8px 12px;background:var(--well);box-shadow:inset 0 -1px 0 var(--seam)}
.qz-taste .qzt-hud-a .stat{text-align:center;line-height:1.1}
.qz-taste .qzt-hud-a .stat b{display:block;font:700 13px var(--f-mono);color:var(--paper)}
.qz-taste .qzt-hud-a .stat span{display:block;margin-top:2px;font:600 10px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.qz-taste .qzt-hud-a .div{width:1px;height:22px;background:var(--seam)}
.qz-taste .qzt-hud-b{display:flex;align-items:center;gap:14px;width:100%;padding:5px 12px;background:var(--well);font:500 11px var(--f-mono);color:var(--soft)}
.qz-taste .qzt-hud-b b{color:var(--rose);font-weight:500}
.qz-taste .qzt-hud-c{display:inline-flex;align-items:center;gap:7px;padding:5px 10px;background:var(--row);box-shadow:inset 0 0 0 1px var(--line);font:600 11px var(--f-mono);color:var(--soft)}
.qz-taste .qzt-hud-c .dot{width:6px;height:6px;background:var(--mint)}

/* 20. toasts */
.qz-taste .qzt-toast-a{display:flex;align-items:center;gap:9px;width:88%;padding:10px 12px;background:var(--panel);box-shadow:0 0 0 1px var(--seam);border-left:3px solid var(--mint)}
.qz-taste .qzt-toast-a b{font:600 13px var(--f-body);color:var(--paper)}
.qz-taste .qzt-toast-b{width:100%;padding:7px 12px;background:var(--rose);color:var(--floor);font:700 12px var(--f-mono);letter-spacing:.04em;text-align:center}
.qz-taste .qzt-toast-c{font:400 12.5px var(--f-mono);color:var(--mint)}
.qz-taste .qzt-toast-c b{color:var(--mute);font-weight:400}

/* 21. confirm dialog */
.qz-taste .qzt-dlg-a{width:84%;padding:16px 18px;background:var(--panel);box-shadow:0 0 0 2px var(--rose-deep);border-top:4px solid #ff8fa8}
.qz-taste .qzt-dlg-a h4{margin:0;font:700 15px var(--f-big);color:var(--paper)}
.qz-taste .qzt-dlg-a p{margin:7px 0 0;font:400 12.5px/1.5 var(--f-body);color:var(--soft)}
.qz-taste .qzt-dlg-a .row{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.qz-taste .qzt-dlg-a .row button{font:700 11px var(--f-body);padding:7px 12px;border:0}
.qz-taste .qzt-dlg-a .row .no{background:none;color:var(--soft);box-shadow:inset 0 0 0 1px var(--line)}
.qz-taste .qzt-dlg-a .row .yes{background:#ff8fa8;color:var(--floor)}
.qz-taste .qzt-dlg-b{width:92%;padding:10px 12px;background:var(--row);box-shadow:inset 0 0 0 1px var(--rose-deep)}
.qz-taste .qzt-dlg-b span{font:400 13px var(--f-body);color:var(--paper)}
.qz-taste .qzt-dlg-b .row{display:flex;gap:8px;margin-top:8px}
.qz-taste .qzt-dlg-b button{font:700 11px var(--f-body);padding:5px 10px;border:0}
.qz-taste .qzt-dlg-b .no{background:var(--panel);color:var(--soft)}
.qz-taste .qzt-dlg-b .yes{background:#ff8fa8;color:var(--floor)}
.qz-taste .qzt-dlg-c{width:100%;padding:16px 16px 14px;background:var(--panel);box-shadow:0 -2px 0 var(--rose-deep) inset}
.qz-taste .qzt-dlg-c .bar{width:34px;height:4px;background:var(--line);margin:0 auto 10px}
.qz-taste .qzt-dlg-c h4{margin:0;font:700 14px var(--f-big);color:var(--paper)}
.qz-taste .qzt-dlg-c .row{display:flex;gap:8px;margin-top:12px}
.qz-taste .qzt-dlg-c button{flex:1;font:700 12px var(--f-body);padding:9px 0;border:0}
.qz-taste .qzt-dlg-c .no{background:var(--row);color:var(--soft)}
.qz-taste .qzt-dlg-c .yes{background:#ff8fa8;color:var(--floor)}

/* 22. empty state */
.qz-taste .qzt-empty-a{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px}
.qz-taste .qzt-empty-a svg{color:var(--line)}
.qz-taste .qzt-empty-a b{font:700 14px var(--f-big);color:var(--paper)}
.qz-taste .qzt-empty-a p{margin:0;font:400 12px var(--f-body);color:var(--mute)}
.qz-taste .qzt-empty-a button{margin-top:4px;background:var(--rose);color:var(--floor);border:0;padding:8px 14px;font:700 12px var(--f-body)}
.qz-taste .qzt-empty-b{text-align:left}
.qz-taste .qzt-empty-b p{margin:0;font:400 13px var(--f-body);color:var(--soft)}
.qz-taste .qzt-empty-b a{color:var(--rose);font-weight:700;text-decoration:underline}
.qz-taste .qzt-empty-c{width:100%;padding:14px 16px;background:var(--well);box-shadow:inset 0 0 0 1px var(--seam)}
.qz-taste .qzt-empty-c b{display:block;font:700 11px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--gold)}
.qz-taste .qzt-empty-c p{margin:6px 0 0;font:400 13px/1.5 var(--f-body);color:var(--soft)}

/* 23. icon style */
.qz-taste .qzt-iconrow{display:flex;gap:16px;align-items:center;justify-content:center}
.qz-taste .qzt-iconrow svg{width:22px;height:22px;color:var(--soft)}
.qz-taste .qzt-iconrow .active svg{color:var(--rose)}
.qz-taste .qzt-iconrow .active{background:#2d1a2a;padding:4px}

/* 24. type pairing */
.qz-taste .qzt-type-a h4{margin:0;font:700 20px var(--f-title);letter-spacing:.03em;color:var(--paper)}
.qz-taste .qzt-type-a p{margin:7px 0 0;font:400 13px/1.6 var(--f-body);color:var(--soft)}
.qz-taste .qzt-type-b h4{margin:0;font:600 22px var(--f-big);color:var(--paper)}
.qz-taste .qzt-type-b p{margin:7px 0 0;font:400 13px/1.6 var(--f-body);color:var(--soft)}
.qz-taste .qzt-type-c h4{margin:0;font:700 15px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--rose)}
.qz-taste .qzt-type-c p{margin:8px 0 0;font:400 13px/1.6 var(--f-body);color:var(--soft)}
.qz-taste .qzt-type-d h4{margin:0;font:700 14px var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--paper)}
.qz-taste .qzt-type-d p{margin:7px 0 0;font:400 12.5px/1.6 var(--f-mono);color:var(--mute)}

/* 25. accent color sample */
.qz-taste .qzt-accent{width:100%;display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:12px;background:var(--panel);border-top:3px solid var(--c)}
.qz-taste .qzt-accent .badge{padding:2px 7px;font:700 10px var(--f-mono);letter-spacing:.06em;text-transform:uppercase;background:var(--c);color:var(--floor)}
.qz-taste .qzt-accent .qzt-bar{width:100%;height:6px}
.qz-taste .qzt-accent .qzt-bar i{width:60%;background:var(--c)}
.qz-taste .qzt-accent b{font:600 12px var(--f-body);color:var(--paper)}

/* 26. hover / selected state */
.qz-taste .qzt-list{display:flex;flex-direction:column;gap:4px;width:100%}
.qz-taste .qzt-list .row{display:flex;align-items:center;padding:8px 10px;font:400 13px var(--f-body);color:var(--soft);background:var(--row)}
.qz-taste .qzt-state-a .row.sel{background:#2d1a2a;color:var(--rose);font-weight:700}
.qz-taste .qzt-state-b .row.sel{box-shadow:inset 3px 0 0 var(--rose);color:var(--rose);font-weight:700}
.qz-taste .qzt-state-c .row.sel{box-shadow:0 0 0 2px var(--rose);color:var(--paper);font-weight:700}
.qz-taste .qzt-state-d .row{position:relative}
.qz-taste .qzt-state-d .row.sel{color:var(--paper);font-weight:700}
.qz-taste .qzt-state-d .row.sel::after{content:"selected";margin-left:auto;padding:1px 7px;background:var(--rose);color:var(--floor);font:700 10px var(--f-mono);text-transform:uppercase}
`,
qs: [

{id:"btn-primary", t:"Which primary button?", hint:"This is the main \"go\" button app-wide.", kind:"one", o:[
 ["solid","Solid fill","Flat color block, bold label", `<div class="mk"><button class="qzt-btnp-a">Continue Story</button></div>`],
 ["hudline","HUD outline","Mono caps, colored line, no fill", `<div class="mk"><button class="qzt-btnp-b">CONTINUE STORY</button></div>`],
 ["chunky","Chunky double border","Thick JRPG-menu block", `<div class="mk"><button class="qzt-btnp-c">Continue Story</button></div>`],
 ["flattext","Flat text, underline","No box at all, just a bar under the label", `<div class="mk"><button class="qzt-btnp-d">Continue Story</button></div>`]]},

{id:"btn-secondary", t:"Which secondary / cancel button?", kind:"one", o:[
 ["line","Thin outline","1px line, quiet text", `<div class="mk"><button class="qzt-btns-a">Cancel</button></div>`],
 ["dim","Dim fill","Faint tinted block, no border", `<div class="mk"><button class="qzt-btns-b">Cancel</button></div>`],
 ["bracket","Corner brackets","Two bracket corners, mono caps", `<div class="mk"><button class="qzt-btns-c">CANCEL</button></div>`]]},

{id:"btn-send", t:"Which Send button?", hint:"The one you tap after typing a message.", kind:"one", o:[
 ["iconsolid","Icon only, solid","A filled square with just an arrow", `<div class="mk"><button class="qzt-send-a" aria-label="Send"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12h14M13 6l6 6-6 6"/></svg></button></div>`],
 ["keychip","Key chip","Looks like a keyboard key, says Enter", `<div class="mk"><div class="qzt-send-b"><kbd>Enter</kbd><span>Send</span></div></div>`],
 ["textcta","Text and arrow","A labeled button, bigger and louder", `<div class="mk"><button class="qzt-send-c">Send<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 6l6 6-6 6"/></svg></button></div>`],
 ["iconquiet","Icon only, quiet","A soft tinted square, no hard fill", `<div class="mk"><button class="qzt-send-d" aria-label="Send"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12h14M13 6l6 6-6 6"/></svg></button></div>`]]},

{id:"toggle", t:"Which toggle switch?", kind:"one", o:[
 ["slide","Sliding dot","Classic switch, a dot that moves", `<div class="mk"><div class="qzt-row"><span class="qzt-sw-a on"></span><span class="qzt-sw-label">Live typing sounds</span></div></div>`],
 ["segment","ON / OFF buttons","Two labeled buttons, one lit", `<div class="mk col"><div class="qzt-seg"><button class="on">ON</button><button>OFF</button></div><span class="qzt-sw-label">Live typing sounds</span></div>`],
 ["lever","HUD lever","Bracket-framed bar that fills when on", `<div class="mk"><div class="qzt-lever on"><span class="track"><i></i></span><span class="txt">TYPING SOUNDS <b>ON</b></span></div></div>`]]},

{id:"checkbox", t:"Which checkbox?", hint:"For picking an option in a list, like pinning a lorebook.", kind:"one", o:[
 ["box","Square box, check icon","A small box next to the label", `<div class="mk"><label class="qzt-cb-row"><span class="qzt-cb-a checked"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="M4 12l5 5L20 6"/></svg></span>Pin to top</label></div>`],
 ["rowhighlight","Whole row lights up","No visible box, the row itself marks picked", `<div class="mk"><div class="qzt-rowsel checked"><span>Pin to top</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 12l5 5L20 6"/></svg></div></div>`],
 ["stamp","Chunky stamp box","A thick-bordered box that fills solid", `<div class="mk"><label class="qzt-cb-row"><span class="qzt-cb-c checked"></span>Pin to top</label></div>`]]},

{id:"chips", t:"Which chip / tag style?", hint:"For lorebook keys, trait tags, that kind of thing.", kind:"one", o:[
 ["tinted","Tinted fill","Soft color-wash background, mono label", `<div class="mk"><div class="qzt-chiprow"><span class="qzt-chip-a" style="--c:var(--lilac)">tide</span><span class="qzt-chip-a" style="--c:var(--mint)">smuggling</span><span class="qzt-chip-a" style="--c:var(--gold)">harbor town</span></div></div>`],
 ["outline","Outline with a dot","Line border, a small color dot leads", `<div class="mk"><div class="qzt-chiprow"><span class="qzt-chip-b" style="--c:var(--lilac)"><i></i>tide</span><span class="qzt-chip-b" style="--c:var(--mint)"><i></i>smuggling</span></div></div>`],
 ["bracket","Bracket text","No box, just colored mono text in brackets", `<div class="mk"><div class="qzt-chiprow"><span class="qzt-chip-c" style="--c:var(--lilac)">[ tide ]</span><span class="qzt-chip-c" style="--c:var(--mint)">[ smuggling ]</span></div></div>`],
 ["removable","Solid, removable","Filled block with its own little x", `<div class="mk"><div class="qzt-chiprow"><span class="qzt-chip-d" style="--c:var(--gold)">harbor town<button aria-label="Remove">&times;</button></span></div></div>`]]},

{id:"meter-progress", t:"Which progress meter?", hint:"For things like scene length or takes used.", kind:"one", o:[
 ["thinbar","Thin bar","A simple flat fill bar with a number", `<div class="mk"><div class="qzt-mp-a"><span class="row"><span>Scene length</span><span>42 / 60</span></span><span class="qzt-bar"><i style="width:70%"></i></span></div></div>`],
 ["segbar","Segmented HUD bar","Tick marks across the fill, mono caps", `<div class="mk"><div class="qzt-mp-b"><span class="row"><span>SCENE LENGTH</span><span>70%</span></span><span class="qzt-bar"><i style="width:70%"></i></span></div></div>`],
 ["pips","Dot pips","Discrete steps instead of a smooth bar", `<div class="mk"><div class="qzt-pips"><span class="dots"><span class="on"></span><span class="on"></span><span class="on"></span><span></span><span></span></span><span class="lbl">Take 3 of 5</span></div></div>`]]},

{id:"meter-context", t:"Which context-fill meter?", hint:"Tokens used against the model's limit, while you play.", kind:"one", o:[
 ["gradient","Gradient bar","Fill color shifts as it fills: calm to warning", `<div class="mk"><div class="qzt-mc-a"><span class="row"><span>Context used</span><span>18.2K / 24K</span></span><span class="qzt-bar"><i style="width:76%"></i></span></div></div>`],
 ["numbers","Numbers only","Big percent, no bar at all", `<div class="mk"><div class="qzt-mc-b"><b>76%</b><span>18.2K / 24K tokens</span></div></div>`],
 ["stacked","Stacked breakdown","One bar split by what's eating the budget", `<div class="mk"><div class="qzt-mc-c"><span class="qzt-bar"><i style="width:30%;background:var(--sky)"></i><i style="width:22%;background:var(--lilac)"></i><i style="width:24%;background:var(--mint)"></i></span><span class="legend"><span style="--c:var(--sky)">Persona</span><span style="--c:var(--lilac)">Lore</span><span style="--c:var(--mint)">History</span></span></div></div>`],
 ["gauge","Vertical gauge","A fuel-gauge style bar, fills bottom to top", `<div class="mk"><div class="qzt-mc-d"><span class="gauge"><i style="height:76%"></i></span><span class="txt"><b>76%</b><span>to limit</span></span></div></div>`]]},

{id:"panel-frame", t:"Which panel frame?", hint:"The box that holds a chunk of content, like a lorebook summary.", kind:"one", o:[
 ["topline","Thin line, colored top edge","One flat border plus an accent stripe on top", `<div class="mk"><div class="qzt-pf-a"><b>Harbor Town</b><p>213 entries. Salt air and smugglers.</p></div></div>`],
 ["brackets","Corner brackets only","No full border, just four bracket corners", `<div class="mk"><div class="qzt-pf-b"><b>Harbor Town</b><p>213 entries. Salt air and smugglers.</p></div></div>`],
 ["double","Double border","A thick double-line box all the way around", `<div class="mk"><div class="qzt-pf-c"><b>Harbor Town</b><p>213 entries. Salt air and smugglers.</p></div></div>`],
 ["headerbar","Solid header bar","A filled color bar as the panel's title strip", `<div class="mk"><div class="qzt-pf-d"><div class="hd">Harbor Town</div><p>213 entries. Salt air and smugglers.</p></div></div>`]]},

{id:"section-header", t:"Which section header style?", hint:"The label above a group of things, like \"Lorebooks\".", kind:"one", o:[
 ["kicker","Kicker and title","Small mono tag above a big serif heading", `<div class="mk left"><div class="qzt-sh-a"><span class="kicker">ACT II</span><h3>Lorebooks</h3></div></div>`],
 ["squaredot","Square dot label","A tiny colored square before a plain mono line", `<div class="mk left"><div class="qzt-sh-b"><span class="sq"></span>This Week</div></div>`],
 ["bar","Full header bar","A row with the title left and a count right", `<div class="mk"><div class="qzt-sh-c"><span>Lorebooks</span><b>18</b></div></div>`]]},

{id:"tabs", t:"Which tab style?", kind:"one", o:[
 ["underline","Underline tabs","Flat row, active tab gets a bottom line", `<div class="mk"><div class="qzt-tabs-a"><button class="on">Scenes</button><button>Takes</button><button>Notes</button></div></div>`],
 ["blocks","Filled blocks","Each tab is its own box, active one fills solid", `<div class="mk"><div class="qzt-tabs-b"><button class="on">SCENES</button><button>TAKES</button><button>NOTES</button></div></div>`],
 ["side","Side list","Tabs stack vertically on the left with a bar marker", `<div class="mk"><div class="qzt-tabs-c"><button class="on">Scenes</button><button>Takes</button><button>Notes</button></div></div>`]]},

{id:"card-character", t:"Which character card in the Library?", kind:"one", o:[
 ["portrait","Tall portrait","Big art area, name below it", `<div class="mk"><div class="qzt-cc-a"><div class="art">V</div><b>Vera Lune</b></div></div>`],
 ["tcg","Trading card","Art on top, a stat strip under it, name last", `<div class="mk"><div class="qzt-cc-b"><div class="art">N</div><div class="stats"><span>LV 9</span><span>12 scenes</span></div><b>Nuit</b></div></div>`],
 ["spine","Shelf spine","A horizontal strip with a colored side bar, no art", `<div class="mk"><div class="qzt-cc-c"><div class="body"><b>The Magpie</b><span class="lvl">LV 6 &middot; 54 entries</span></div></div></div>`],
 ["minimal","Minimal row","Small avatar, name and detail take the space", `<div class="mk"><div class="qzt-cc-d"><span class="av">C</span><div><b>Corvin Ashe</b><span>Rogue, keeps the books</span></div></div></div>`]]},

{id:"card-scene", t:"Which scene card in the Scenes list?", kind:"one", o:[
 ["grid","Portrait grid card","Fixed-size art tile, title over the bottom", `<div class="mk"><div class="qzt-cs-a"><span class="badge">Live</span><div class="ov"><div class="who">Vera Lune</div><h4>The long storm</h4></div></div></div>`],
 ["listrow","Horizontal list row","Avatar left, title and meta right, no art tile", `<div class="mk"><div class="qzt-cs-b"><span class="av">V</span><div><b>The long storm</b><span>Vera Lune &middot; 42 msgs</span></div><time>2h</time></div></div>`],
 ["textcard","Text-forward card","No art at all, just a clean text panel", `<div class="mk"><div class="qzt-cs-c"><b>The long storm</b><p>Vera Lune &middot; 42 msgs &middot; 2h ago</p></div></div>`]]},

{id:"hero-continue", t:"Which hero \"continue your story\" card?", hint:"The big one at the top of Scenes.", kind:"one", o:[
 ["bigart","Big art hero","Full art background, text and a meter over it", `<div class="mk"><div class="qzt-hero-a"><div class="ov"><h4>The long storm</h4><div class="sub">Vera Lune &middot; Take 2</div><span class="qzt-bar"><i style="width:70%"></i></span><span class="go">Continue Story</span></div></div></div>`],
 ["banner","Compact banner","A smaller horizontal strip, thumbnail plus a button", `<div class="mk"><div class="qzt-hero-b"><div class="art"></div><div><b>The long storm</b><span>Vera Lune &middot; Take 2</span></div><button>Continue</button></div></div>`],
 ["textonly","Plain text callout","No art at all, just a quiet prompt and a button", `<div class="mk"><div class="qzt-hero-c"><span>Pick up where you left off</span><b>The long storm</b><button>Continue Story</button></div></div>`]]},

{id:"msg-ai", t:"Which style for an AI reply in chat?", kind:"one", o:[
 ["bubble","Bubble","Avatar beside a boxed bubble", `<div class="mk left"><div class="qzt-msg-a"><span class="av">V</span><div class="bb"><b>Vera Lune</b><p>*She strikes the match, cupping the flame against the wind.*</p></div></div></div>`],
 ["prose","Novel prose","Full width, no box, name tag above the line", `<div class="mk left"><div class="qzt-msg-b"><b>Vera Lune</b><p>She struck the match and cupped the flame against the wind, waiting for him to answer.</p></div></div>`],
 ["screenplay","Screenplay","Name in caps, dialogue below, no avatar", `<div class="mk left"><div class="qzt-msg-c"><b>Vera Lune</b><p>&ldquo;Deal. Just don't let it go out this time.&rdquo;</p></div></div>`],
 ["vnbox","Visual novel box","A framed text box like a VN dialogue window", `<div class="mk"><div class="qzt-msg-d"><b>VERA LUNE</b><p>*She strikes the match, cupping the flame against the wind.*</p></div></div>`]]},

{id:"msg-you", t:"Which style for your own message?", hint:"Should it look different from the AI's reply, and how much?", kind:"one", o:[
 ["mirrorbubble","Mirrored bubble, other side","Same bubble shape, flipped to the right, dimmer color", `<div class="mk left"><div class="qzt-msg-a you"><span class="av">Y</span><div class="bb"><b>You</b><p>Deal. Just don't let it go out this time.</p></div></div></div>`],
 ["sameprose","Same prose, just a label","No side difference at all, only the name changes", `<div class="mk left"><div class="qzt-msg-b you"><b>You</b><p>Deal. Just don't let it go out this time.</p></div></div>`],
 ["quietright","Quiet and small, right-aligned","Smaller text, less visual weight than the AI's reply", `<div class="mk left"><div class="qzt-msgyou-b"><p>Deal. Just don't let it go out this time.</p></div></div>`]]},

{id:"swipe", t:"Which swipe control, for alternate replies?", kind:"one", o:[
 ["arrows","Arrows with a count","Simple prev / next with a position count", `<div class="mk"><div class="qzt-swipe-a"><button>&lsaquo;</button><span>2 / 5</span><button>&rsaquo;</button></div></div>`],
 ["dots","Dot row","A row of dots, current one lit", `<div class="mk"><div class="qzt-swipe-b"><div class="dots"><span></span><span class="on"></span><span></span><span></span><span></span></div><span class="qzt-sw-label">Reply 2 of 5</span></div></div>`],
 ["carousel","Side-peek cards","Next card peeks in from the edge", `<div class="mk"><div class="qzt-swipe-c"><div class="peek"></div><div class="main">She hesitated before answering.</div><div class="peek"></div></div></div>`],
 ["keychips","Key chips","Looks like keyboard shortcuts, not buttons", `<div class="mk"><div class="qzt-swipe-d"><span class="hud-key"><kbd>A</kbd>Prev</span><span style="color:var(--mute);font:600 11px var(--f-mono)">2 / 5</span><span class="hud-key"><kbd>D</kbd>Next</span></div></div>`]]},

{id:"composer", t:"Which composer (the typing box)?", kind:"one", o:[
 ["singleline","Single line, icons inline","One row: a text field with small icons at the end", `<div class="mk"><div class="qzt-comp-a"><svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20 L15 9 L18 12 L7 23z"/></svg><span class="fake-input">Type your reply&hellip;</span><span class="sendsq"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M4 12h14M13 6l6 6-6 6"/></svg></span></div></div>`],
 ["toolbar","Tools above, field below","A row of tool icons sits above the text box", `<div class="mk col"><div class="qzt-comp-b"><div class="tools"><span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18"/><path d="M3 15l5-5 4 4 5-6 4 5"/></svg></span><span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><circle cx="12" cy="12" r="3"/></svg></span><span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><path d="M4 9h16M9 4v16"/></svg></span></div><div class="inrow"><span class="fake-input">Type your reply&hellip;</span><button>Send</button></div></div></div>`],
 ["gamebox","Game dialogue box","Bracket-framed box, blinking caret, Enter hint", `<div class="mk"><div class="qzt-comp-c"><div class="in">&gt; Type your reply<span class="caret">_</span></div><div class="hint"><kbd>Enter</kbd> to send</div></div></div>`]]},

{id:"hud-strip", t:"Which HUD info strip (tokens, cost, lore fired)?", kind:"one", o:[
 ["alwayson","Always-on top strip","A full-width strip with stat blocks and dividers", `<div class="mk"><div class="qzt-hud-a"><div class="stat"><b>18.2K</b><span>Tokens</span></div><div class="div"></div><div class="stat"><b>$0.02</b><span>Cost</span></div><div class="div"></div><div class="stat"><b>3</b><span>Lore</span></div></div></div>`],
 ["statusline","Thin bottom line","A single quiet mono line, low visual weight", `<div class="mk"><div class="qzt-hud-b"><span>Tokens <b>18.2K</b></span><span>Cost <b>$0.02</b></span><span>Lore fired <b>3</b></span></div></div>`],
 ["chip","Collapsed chip","A small badge that expands when you want detail", `<div class="mk"><div class="qzt-hud-c"><span class="dot"></span>HUD &middot; 18.2K tok &middot; 3 lore</div></div>`]]},

{id:"toast", t:"Which toast (a quick \"it worked\" message)?", kind:"one", o:[
 ["cardcorner","Card, left accent bar","A small boxed card with a colored edge", `<div class="mk"><div class="qzt-toast-a"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="color:var(--mint)"><path d="M4 12l5 5L20 6"/></svg><b>Scene saved</b></div></div>`],
 ["ticker","Top ticker bar","A single solid-color bar across the top", `<div class="mk"><div class="qzt-toast-b">SCENE SAVED</div></div>`],
 ["logline","Quiet log line","Plain mono text, no card at all", `<div class="mk"><div class="qzt-toast-c"><b>12:04</b> Scene saved</div></div>`]]},

{id:"confirm-dialog", t:"Which confirm dialog (for deleting something)?", kind:"one", o:[
 ["modal","Centered modal","A boxed dialog over a dimmed background", `<div class="mk"><div class="qzt-dlg-a"><h4>Cut this story?</h4><p>&ldquo;Cut the deck&rdquo; and every message in it, for good.</p><div class="row"><button class="no">Cancel</button><button class="yes">Delete</button></div></div></div>`],
 ["inline","Inline, right where you clicked","No modal, the row itself turns into a confirm", `<div class="mk"><div class="qzt-dlg-b"><span>Delete &ldquo;Cut the deck&rdquo;?</span><div class="row"><button class="no">Cancel</button><button class="yes">Yes, delete</button></div></div></div>`],
 ["sheet","Slide-up sheet","A panel from the bottom, like a phone action sheet", `<div class="mk"><div class="qzt-dlg-c"><div class="bar"></div><h4>Delete &ldquo;Cut the deck&rdquo;?</h4><div class="row"><button class="no">Cancel</button><button class="yes">Delete</button></div></div></div>`]]},

{id:"empty-state", t:"Which empty state (\"no scenes yet\")?", kind:"one", o:[
 ["bigicon","Big icon and button","A simple drawn mark, a heading, a clear next step", `<div class="mk col"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16"/><path d="M9 9l6 3-6 3V9z"/></svg><b>No scenes yet</b><p>Pick a character and say hello.</p><button>Start a scene</button></div>`],
 ["minimal","One line and a link","No icon, no fuss, just text and a link", `<div class="mk col left"><div class="qzt-empty-b"><p>Nothing here yet. <a href="#">Start a scene</a></p></div></div>`],
 ["guide","Hint box","A framed tip, more guiding than decorative", `<div class="mk"><div class="qzt-empty-c"><b>No scenes yet</b><p>Open a character from the Library and your first message starts a scene here.</p></div></div>`]]},

{id:"icon-style", t:"Which icon style?", hint:"Same six icons, drawn four ways: play, library, share, help, settings, search.", kind:"one", o:[
 ["line","Line","Outline only, same weight everywhere", `<div class="mk"><div class="qzt-iconrow">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4l12 8-12 8V4z"/></svg>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><path d="M4 9h16M9 4v16"/></svg>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><path d="M8 16l4-8 4 8"/></svg>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><path d="M9 9c0-2 2-3 3-3s3 1 3 3-3 2-3 4M12 16h.01"/></svg>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><circle cx="12" cy="12" r="3"/></svg>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
 </div></div>`],
 ["filled","Filled","Solid silhouettes", `<div class="mk"><div class="qzt-iconrow">
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l12 8-12 8V4z"/></svg>
  <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="currentColor"/><path d="M4 9h16M9 4v16" stroke="var(--well)" stroke-width="2"/></svg>
  <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="currentColor"/><path d="M8 16l4-8 4 8" stroke="var(--well)" stroke-width="2" fill="none"/></svg>
  <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="currentColor"/><path d="M9 9c0-2 2-3 3-3s3 1 3 3-3 2-3 4M12 16h.01" stroke="var(--well)" stroke-width="2" fill="none"/></svg>
  <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="currentColor"/><circle cx="12" cy="12" r="3" fill="var(--well)"/></svg>
  <svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="12" height="12"/><rect x="16" y="16" width="6" height="3" transform="rotate(45 16 16)"/></svg>
 </div></div>`],
 ["duo","Two-tone","Faint fill plus a solid-colored outline", `<div class="mk"><div class="qzt-iconrow">
  <svg viewBox="0 0 24 24" fill="var(--rose)" fill-opacity=".25" stroke="var(--rose)" stroke-width="2"><path d="M6 4l12 8-12 8V4z"/></svg>
  <svg viewBox="0 0 24 24" fill="var(--rose)" fill-opacity=".25" stroke="var(--rose)" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><path d="M4 9h16M9 4v16" fill-opacity="1" stroke="var(--rose)"/></svg>
  <svg viewBox="0 0 24 24" fill="var(--rose)" fill-opacity=".25" stroke="var(--rose)" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><path d="M8 16l4-8 4 8" fill="none"/></svg>
  <svg viewBox="0 0 24 24" fill="var(--rose)" fill-opacity=".25" stroke="var(--rose)" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><path d="M9 9c0-2 2-3 3-3s3 1 3 3-3 2-3 4M12 16h.01" fill="none"/></svg>
  <svg viewBox="0 0 24 24" fill="var(--rose)" fill-opacity=".25" stroke="var(--rose)" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><circle cx="12" cy="12" r="3" fill="none"/></svg>
  <svg viewBox="0 0 24 24" fill="var(--rose)" fill-opacity=".25" stroke="var(--rose)" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3" fill="none"/></svg>
 </div></div>`],
 ["mixed","Line, filled when active","Plain line icons, the active one turns filled and colored", `<div class="mk"><div class="qzt-iconrow">
  <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4l12 8-12 8V4z"/></svg></span>
  <span class="active"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16"/><path d="M4 9h16M9 4v16" stroke="var(--well)" stroke-width="2"/></svg></span>
  <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><path d="M8 16l4-8 4 8"/></svg></span>
  <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><path d="M9 9c0-2 2-3 3-3s3 1 3 3-3 2-3 4M12 16h.01"/></svg></span>
  <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><circle cx="12" cy="12" r="3"/></svg></span>
  <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></span>
 </div></div>`]]},

{id:"type-pairing", t:"Which title and body type pairing?", hint:"Same heading, same paragraph, four font pairings.", kind:"one", o:[
 ["engraved","Engraved serif title","Cinzel heading, plain body underneath", `<div class="mk col left"><div class="qzt-type-a"><h4>The Long Storm</h4><p>Vera picks up the thread where the storm broke it off. Rain against glass, and a question she still hasn't answered.</p></div></div>`],
 ["softserif","Soft display title","Fraunces heading, warmer and rounder feel", `<div class="mk col left"><div class="qzt-type-b"><h4>The Long Storm</h4><p>Vera picks up the thread where the storm broke it off. Rain against glass, and a question she still hasn't answered.</p></div></div>`],
 ["hudmono","HUD mono title","Mono caps heading, colored, plain body below", `<div class="mk col left"><div class="qzt-type-c"><h4>The Long Storm</h4><p>Vera picks up the thread where the storm broke it off. Rain against glass, and a question she still hasn't answered.</p></div></div>`],
 ["allmono","All mono, terminal feel","Title and body both set in mono type", `<div class="mk col left"><div class="qzt-type-d"><h4>The Long Storm</h4><p>Vera picks up the thread where the storm broke it off. Rain against glass, and a question she still hasn't answered.</p></div></div>`]]},

{id:"accent-sample", t:"Which accent color, shown on a real sample?", hint:"Same little badge and bar, four colors. Pick any you like, top pick first.", kind:"many", o:[
 ["rose","Rose","", `<div class="mk"><div class="qzt-accent" style="--c:var(--rose)"><span class="badge">LIVE</span><span class="qzt-bar"><i></i></span><b>Rose</b></div></div>`],
 ["sky","Sky blue","", `<div class="mk"><div class="qzt-accent" style="--c:var(--sky)"><span class="badge">LIVE</span><span class="qzt-bar"><i></i></span><b>Sky</b></div></div>`],
 ["gold","Gold","", `<div class="mk"><div class="qzt-accent" style="--c:var(--gold)"><span class="badge">LIVE</span><span class="qzt-bar"><i></i></span><b>Gold</b></div></div>`],
 ["mint","Mint","", `<div class="mk"><div class="qzt-accent" style="--c:var(--mint)"><span class="badge">LIVE</span><span class="qzt-bar"><i></i></span><b>Mint</b></div></div>`]]},

{id:"hover-selected", t:"Which way should a selected row look?", hint:"Same three-name list, middle row picked, four mechanisms.", kind:"one", o:[
 ["fill","Background fill","The picked row gets a solid tinted background", `<div class="mk"><div class="qzt-list qzt-state-a"><div class="row">Vera Lune</div><div class="row sel">Nuit</div><div class="row">The Magpie</div></div></div>`],
 ["leftbar","Left accent bar","A colored bar on the left, background stays put", `<div class="mk"><div class="qzt-list qzt-state-b"><div class="row">Vera Lune</div><div class="row sel">Nuit</div><div class="row">The Magpie</div></div></div>`],
 ["ring","Outline ring","A full box outline around the picked row only", `<div class="mk"><div class="qzt-list qzt-state-c"><div class="row">Vera Lune</div><div class="row sel">Nuit</div><div class="row">The Magpie</div></div></div>`],
 ["badge","Corner badge","A small \"selected\" tag appears on the row", `<div class="mk"><div class="qzt-list qzt-state-d"><div class="row">Vera Lune</div><div class="row sel">Nuit</div><div class="row">The Magpie</div></div></div>`]]}

]
};
