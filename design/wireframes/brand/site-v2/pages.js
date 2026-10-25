/*
 * Each page as markup. Everything interpolated goes through esc(), including the site's own data,
 * so release notes read live from GitHub can never become markup.
 */
(function () {
  var S = window.SITE;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function feature(id) { return S.features.find(function (f) { return f.id === id; }); }
  window.esc = esc;

  var foot =
    '<footer class="foot"><div class="wrap">' +
    '<div><a class="brand" href="#/"><svg><use href="#tk"/></svg><span>BUN<i>·</i>RAKU</span></a><p class="whisper">A little stage for your AI characters.</p></div>' +
    '<div><h4>The Show</h4><a href="#/tour">The Tour</a><a href="#/whats-new">What’s New</a><a href="#/try">Try It</a></div>' +
    '<div><h4>Help</h4><a href="#/guides">Guides</a><a href="#/guides/start">Your First Scene</a><a href="#/guides/trouble">Something Went Wrong</a></div>' +
    '<div><h4>The Company</h4><a href="https://github.com/' + esc(S.repo) + '">GitHub</a><a href="https://github.com/Coneja-Chibi">Coneja-Chibi</a><a href="#/download">Download</a></div>' +
    "</div></footer>";

  var P = {};

  P.home = function () {
    var acts = S.features.slice(0, 3).map(function (f, i) {
      return '<a class="card act feat-' + ["rose", "violet", "pink"][i] + ' reveal" href="#/tour/' + esc(f.id) + '" style="--c:' + f.cs + '">' +
        '<div class="doodle">' + window.bunny({ body: "var(--paper)" }) + "</div>" +
        '<span class="num">' + esc(f.rn) + "</span><h3>" + esc(f.genre) + '</h3><p>' + esc(f.lede) + '</p><span class="go">Meet the ' + esc(f.name) + " →</span></a>";
    }).join("");
    var fmts = S.formats.concat(S.formats).map(function (f) { return '<span class="fmt" style="--c:' + f[1] + ";--cs:" + f[2] + '">' + esc(f[0]) + "</span>"; }).join("");
    var faq = S.faq.map(function (q) { return "<details><summary>" + esc(q[0]) + "</summary><p>" + esc(q[1]) + "</p></details>"; }).join("");
    return '<div class="home">' +
      // Curtain I: the marquee
      '<section class="curtain" id="c-hero"><div class="wrap"><div class="hero-grid">' +
        '<div class="reveal"><span class="eyebrow pink">✦ Now showing · Free forever ✦</span>' +
        '<h1 class="marquee-title t-xxl">Your cast.<br>Your <em class="p">stage.</em></h1>' +
        '<p class="whisper">A little stage for your AI characters, living right on your own computer.</p>' +
        '<div class="cta-row"><a class="btn btn-rose btn-big" href="#/download"><span class="spark">✦</span> <span data-os-cta>Get Bunraku for Windows</span></a><a class="btn btn-big" href="#/tour">Take the Tour</a></div>' +
        '<p class="os-note" style="margin-top:16px" data-os-note>Also for Mac and Linux · no account needed</p></div>' +
        '<div class="stage reveal" id="stage"><div class="spot"></div><div class="floor"></div>' + window.bunny({ bow: true, cls: "hero-bun" }) +
        '<span class="spark-float" style="left:8%;top:18%">✦</span><span class="spark-float" style="right:6%;top:30%;animation-delay:1.1s">✧</span><span class="spark-float" style="left:18%;top:52%;animation-delay:2s">✶</span></div>' +
      '</div></div><div class="scroll-cue">Scroll<i></i></div></section>' +
      // Curtain II: the scene
      '<section class="curtain"><div class="wrap"><div class="scene-grid">' +
        '<div class="reveal"><span class="eyebrow">Act I · Scenes</span><h2 class="marquee-title t-xl">Talk to <em>anyone.</em></h2>' +
        '<p class="whisper">Bring a character, pick any AI you like, and play.</p>' +
        '<p class="explain" style="margin-top:18px">Every reply can be swapped for another, and every old version is kept. Try the arrows on Vera’s first line.</p>' +
        '<div class="cta-row"><a class="btn" href="#/tour/scenes">How Scenes Work</a></div></div>' +
        '<div class="panel chat reveal" id="chat"><div class="chat-top"><div class="face" style="--c1:var(--gold);--c2:var(--cat-amber);width:40px;height:52px;font-size:1.1rem">V</div><b>Vera</b><span class="live-chip">NOW PLAYING</span></div><div id="chatBody"></div></div>' +
      "</div></div></section>" +
      // Curtain III: the acts
      '<section class="curtain"><div class="wrap"><div class="reveal"><span class="eyebrow violet">The three acts</span><h2 class="marquee-title t-xl">Play. Make. <em class="v">Keep.</em></h2><p class="whisper">Everything you need for a story, under one little roof.</p></div>' +
        '<div class="acts">' + acts + "</div></div></section>" +
      // Curtain IV: formats
      '<section class="curtain"><div class="wrap" style="padding-bottom:20px"><div class="reveal"><span class="eyebrow gold">Bring your cast</span><h2 class="marquee-title t-xl">Come as <em class="g">you are.</em></h2><p class="whisper">Cards from the apps you already use walk right in.</p></div></div>' +
        '<div style="width:100%;position:absolute;bottom:clamp(40px,8vh,90px)"><div class="formats"><div class="track">' + fmts + "</div></div></div></section>" +
      // Curtain V: paper, the programme notes
      '<section class="curtain paper" id="c-paper"><div class="wrap"><div class="reveal"><span class="eyebrow">Programme notes</span><h2 class="marquee-title t-xl">Before the <em>lights go down.</em></h2></div><div class="faq reveal">' + faq + "</div></div></section>" +
      // Curtain VI: the finale ticket
      '<section class="curtain finale"><div class="wrap"><div class="reveal"><span class="eyebrow pink">✦ Admit one ✦</span><h2 class="marquee-title t-xl">Take your <em class="p">seat.</em></h2></div>' +
        '<div class="big-ticket reveal"><div class="main"><div class="adm">ADMIT ONE · FREE FOREVER</div><h3>BUNRAKU</h3><ul><li>Chat with any character, using your own AI.</li><li>Import cards from the apps you already use.</li><li>Everything stays private on your computer.</li></ul></div>' +
        '<div class="stub"><svg><use href="#tk"/></svg><a class="btn btn-rose" href="#/download">Download</a><span class="serial" data-serial>No. 000142</span></div></div></div></section>' +
      "</div>" + foot;
  };

  P.tour = function () {
    var cards = S.features.map(function (f, i) {
      return '<a class="card fcard reveal ' + (i < 3 ? "feat-" + ["rose", "violet", "pink"][i] : "") + '" href="#/tour/' + esc(f.id) + '" style="--c1:' + f.c1 + ";--c2:" + f.c2 + ";--cs:" + f.cs + '"><div class="cover"><span class="rn">' + esc(f.rn) + '</span></div><div class="body"><span class="genre">' + esc(f.genre) + "</span><h3>" + esc(f.name) + '</h3><span class="tag">' + esc(f.tag) + "</span></div></a>";
    }).join("");
    return '<div class="wrap"><div class="hero-panel reveal"><div class="bloom"></div><span class="eyebrow">The Tour</span><h1 class="marquee-title t-xl">Meet the <em>company.</em></h1><p class="whisper">Five rooms under one roof, each doing one thing well.</p></div>' +
      '<div class="feature-rail">' + cards + "</div></div>" + foot;
  };

  P.feature = function (id) {
    var f = feature(id) || S.features[0], i = S.features.indexOf(f);
    var prev = S.features[(i + S.features.length - 1) % S.features.length], next = S.features[(i + 1) % S.features.length];
    return '<div class="wrap" style="--c1:' + f.c1 + ";--c2:" + f.c2 + '"><div class="feature-hero">' +
      '<div class="reveal"><span class="eyebrow" style="color:' + f.cs + '">Act ' + esc(f.rn) + " · " + esc(f.genre) + '</span><h1 class="marquee-title t-xl" style="font-size:clamp(3rem,6.4vw,6rem)">' + esc(f.name) + '</h1><p class="whisper">' + esc(f.tag) + '</p><p class="explain" style="margin-top:18px">' + esc(f.lede) + "</p>" +
      '<div class="knock">' + f.proves.map(function (x) { return "<div>" + esc(x) + "</div>"; }).join("") + "</div></div>" +
      '<div class="shot reveal"><div class="fake"><i></i><i></i></div><div class="label">A short looping clip of ' + esc(f.name) + " goes here, recorded from the real app.</div></div></div>" +
      '<div class="act-break"><span>✦ Intermission ✦</span></div>' +
      '<div class="pager"><a class="btn" href="#/tour/' + esc(prev.id) + '">← ' + esc(prev.name) + '</a><a class="btn btn-rose" href="#/tour/' + esc(next.id) + '">' + esc(next.name) + " →</a></div></div>" + foot;
  };

  P.guides = function () {
    var cats = S.guideCats.map(function (c) {
      return '<div class="card gcat reveal" style="--c:' + c.c + ";box-shadow:6px 6px 0 " + c.c + '"><span class="eyebrow" style="color:' + c.c + '">' + esc(c.guides.length) + " guides</span><h3>" + esc(c.name) + "</h3>" +
        c.guides.map(function (g) { return '<a class="g" href="#/guides/' + esc(g) + '">' + esc(S.guides[g].title) + "</a>"; }).join("") + "</div>";
    }).join("");
    return '<div class="wrap"><div class="hero-panel reveal" style="border-color:var(--cat-pink)"><div class="bloom"></div><span class="eyebrow pink">Guides &amp; help</span><h1 class="marquee-title t-xl">How do I <em class="p">...?</em></h1><p class="whisper">Short, friendly answers, with pictures from the real app.</p>' +
      '<label class="search"><input id="q" placeholder="Search the guides: import, preset, swipe, backup" aria-label="Search the guides" autocomplete="off"><span class="kbd">/</span></label></div>' +
      '<div class="results" id="results"></div><div class="gcats" id="gcats">' + cats + "</div></div>" + foot;
  };

  P.article = function (id) {
    var g = S.guides[id] || S.guides.start;
    var cat = S.guideCats.find(function (c) { return c.guides.indexOf(id) >= 0; }) || S.guideCats[0];
    var toc = g.sections.map(function (s, n) { return '<a href="#/guides/' + esc(id) + '" data-sec="s' + n + '"' + (n === 0 ? ' class="on"' : "") + ">" + esc(s.h) + "</a>"; }).join("");
    var prose = g.sections.map(function (s, n) {
      return '<h2 id="s' + n + '">' + esc(s.h) + "</h2><p>" + esc(s.p) + "</p>" +
        (s.steps ? '<div class="steps">' + s.steps.map(function (x) { return "<div>" + esc(x) + "</div>"; }).join("") + "</div>" : "") +
        (s.tip ? '<div class="bun-tip">' + window.bunny() + "<p><b>A little tip</b>" + esc(s.tip) + "</p></div>" : "");
    }).join("");
    return '<div class="wrap"><span class="eyebrow" style="color:' + cat.c + '"><a href="#/guides" style="color:inherit">Guides</a> · ' + esc(cat.name) + '</span><h1 class="marquee-title t-l">' + esc(g.title) + '</h1><p class="whisper">' + esc(g.about) + "</p>" +
      '<div class="doc"><nav class="toc"><span class="eyebrow">On this page</span>' + toc + '</nav><article class="prose">' + prose + "</article></div></div>" + foot;
  };

  P.download = function () {
    return '<div class="wrap"><div class="hero-panel reveal"><div class="bloom"></div><span class="eyebrow">Download</span><h1 class="marquee-title t-xl">Grab your <em>ticket.</em></h1><p class="whisper">Free, open source, and yours to keep.</p></div>' +
      '<div class="dl-grid"><div class="reveal"><div class="big-ticket" style="margin:0;transform:rotate(-1deg)"><div class="main"><div class="adm" data-dl-adm>ADMIT ONE · WINDOWS</div><h3 data-dl-title>BUNRAKU</h3><ul><li data-dl-ver>Latest version</li><li data-dl-size>One file</li><li>Your library lives in Documents, in Bunraku Studio.</li></ul></div>' +
      '<div class="stub"><svg><use href="#tk"/></svg><a class="btn btn-rose" data-dl-btn>Download</a><span class="serial">Free forever</span></div></div>' +
      '<div class="warn-card"><span class="eyebrow">First time opening it</span><p class="explain" style="margin-top:10px">Windows may say it does not recognize Bunraku, because it is new and not signed yet. Choose <b>More info</b>, then <b>Run anyway</b>. Bunraku adds itself to your Start menu the first time it opens.</p></div></div>' +
      '<div class="reveal"><span class="eyebrow violet">Every platform</span><div id="plats" style="margin-top:16px"></div><p class="source" data-dl-source></p></div></div></div>' + foot;
  };

  P["whats-new"] = function () {
    return '<div class="wrap"><div class="hero-panel reveal" style="border-color:var(--gold)"><div class="bloom"></div><span class="eyebrow gold">What’s new</span><h1 class="marquee-title t-xl">Fresh from <em class="g">rehearsal.</em></h1><p class="whisper">Every release, newest first. This page keeps itself up to date.</p></div>' +
      '<div class="releases" id="releases"><div class="loading">' + window.bunny() + "The cast is taking their places…</div></div></div>" + foot;
  };

  P.try = function () {
    return '<div class="wrap"><div class="try"><div class="reveal"><span class="eyebrow pink">No install</span><h1 class="marquee-title t-xl">Try it in your <em class="p">browser.</em></h1><p class="whisper">Open the Studio right here, no account needed.</p>' +
      '<div class="can"><div class="y">Import cards and look around.</div><div class="y">Edit characters, lorebooks, and presets.</div><div class="y">Export what you make.</div><div class="n">Chatting with AI needs the app.</div><div class="n">Work stays only while the tab is open.</div></div>' +
      '<div class="cta-row"><a class="btn btn-rose btn-big" href="studio/">Open the Studio</a><a class="btn btn-big" href="#/download">Get the Full App</a></div></div>' +
      '<div class="stage reveal" style="aspect-ratio:1"><div class="spot"></div><div class="floor"></div>' + window.bunny({ cls: "hero-bun" }) + "</div></div></div>" + foot;
  };

  window.PAGES = P;
})();
