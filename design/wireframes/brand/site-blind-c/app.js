/* Bunzai site: hash router, live releases with fallback, OS detection, guide search, demo. */
(function () {
  "use strict";

  var D = window.BUNZAI_DATA;
  var main = document.getElementById("main");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- helpers ---------- */
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function safeUrl(u, fallback) {
    return typeof u === "string" && u.indexOf("https://github.com/") === 0 ? u : fallback;
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  }
  function fmtSize(bytes) {
    if (typeof bytes !== "number" || !isFinite(bytes) || bytes <= 0) return "";
    return Math.round(bytes / 1048576) + " MB";
  }
  function versionOf(r) { return String(r.tag_name || "").replace(/^v/i, ""); }

  var icon = {
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  var logoSvg = '<svg class="logo" viewBox="0 0 64 40" aria-hidden="true"><path mask="url(#bunny-punch)" fill="currentColor" d="M6 2h52a4 4 0 0 1 4 4v9a5 5 0 0 0 0 10v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-9a5 5 0 0 0 0-10V6a4 4 0 0 1 4-4z"/></svg>';

  /* ---------- OS detection ---------- */
  function detectOS() {
    var p = "";
    try { if (navigator.userAgentData && navigator.userAgentData.platform) p = navigator.userAgentData.platform; } catch (e) {}
    var ua = navigator.userAgent || "";
    var s = (p + " " + ua).toLowerCase();
    var mobile = (navigator.userAgentData && navigator.userAgentData.mobile) ||
      /android|iphone|ipad|ipod|mobile/.test(s) ||
      (/macintosh/.test(s) && navigator.maxTouchPoints > 1); // iPadOS reports as Mac
    if (mobile) return null;
    if (/win/.test(s)) return "windows";
    if (/mac/.test(s)) return "mac";
    if (/linux|x11|cros/.test(s)) return "linux";
    return null;
  }
  var OS = detectOS();

  /* ---------- releases: one fetch per page load, shared ---------- */
  var releasesPromise = null;
  function getReleases() {
    if (releasesPromise) return releasesPromise;
    var fallback = { live: false, list: D.sampleReleases };
    if (!window.fetch) { releasesPromise = Promise.resolve(fallback); return releasesPromise; }
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    releasesPromise = fetch("https://api.github.com/repos/" + D.repo + "/releases?per_page=100", {
      headers: { Accept: "application/vnd.github+json" },
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error("status " + res.status);
      return res.json();
    }).then(function (json) {
      if (!Array.isArray(json)) throw new Error("bad shape");
      var list = json.filter(function (r) { return r && !r.draft && typeof r.tag_name === "string"; });
      if (!list.length) throw new Error("empty");
      list.sort(function (a, b) { return new Date(b.published_at) - new Date(a.published_at); });
      return { live: true, list: list };
    }).catch(function () {
      return fallback;
    }).then(function (r) { clearTimeout(timer); return r; });
    return releasesPromise;
  }

  function assetFor(release, osKey) {
    var exts = D.systems[osKey].exts;
    var assets = Array.isArray(release.assets) ? release.assets : [];
    for (var i = 0; i < assets.length; i++) {
      var n = String(assets[i].name || "").toLowerCase();
      for (var j = 0; j < exts.length; j++) if (n.slice(-exts[j].length) === exts[j]) return assets[i];
    }
    return null;
  }
  function downloadInfo(data, osKey) {
    var r = data.list[0];
    var a = data.live ? assetFor(r, osKey) : null;
    return {
      href: a ? safeUrl(a.browser_download_url, D.releasesPage) : safeUrl(r.html_url, D.releasesPage),
      size: a ? fmtSize(a.size) : (data.live ? "" : D.sampleSizes[osKey]),
      sizeIsSample: !data.live,
      version: versionOf(r),
      date: fmtDate(r.published_at)
    };
  }

  /* Tiny markdown subset, applied AFTER escaping. */
  function renderNotes(body) {
    var lines = esc(body || "").split(/\r?\n/);
    var out = [], inList = false;
    function inline(t) {
      return t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
    }
    lines.forEach(function (line) {
      var m = line.match(/^\s*[-*]\s+(.*)$/);
      if (m) { if (!inList) { out.push("<ul>"); inList = true; } out.push("<li>" + inline(m[1]) + "</li>"); return; }
      if (inList) { out.push("</ul>"); inList = false; }
      var h = line.match(/^\s*#{1,6}\s+(.*)$/);
      if (h) { out.push("<h4>" + inline(h[1]) + "</h4>"); return; }
      if (line.trim()) out.push("<p>" + inline(line) + "</p>");
    });
    if (inList) out.push("</ul>");
    return out.join("") || "<p class=\"muted\">No notes for this release.</p>";
  }

  /* ---------- pages ---------- */
  function downloadButton(big) {
    var label = OS ? "Download for " + D.systems[OS].name : "Download Bunzai";
    var sub = OS ? "Free. Version <span data-version>0.1</span>" : "Windows, Mac and Linux";
    return '<a class="btn btn-stamp' + (big ? " btn-big" : "") + '" href="#/download" data-dl-button>' + icon.download +
      '<span>' + label + (big ? '<span class="btn-sub">' + sub + "</span>" : "") + "</span></a>";
  }

  function pageHome() {
    var demo = D.demo;
    return '' +
    '<section class="hero"><div class="wrap hero-grid">' +
      '<div>' +
        '<p class="eyebrow">Free and open source</p>' +
        '<h1 tabindex="-1">Your characters. Your stories. <em>Your computer.</em></h1>' +
        '<p class="lead">Bunzai is a cozy desktop app for playing and making AI roleplay characters. Bring your cards, use your own AI key, and keep everything private on your machine.</p>' +
        '<div class="hero-cta">' + downloadButton(true) +
          '<a class="link-arrow" href="#/try">Or try the Studio in your browser ' + icon.arrow + '</a></div>' +
        '<div class="hero-meta"><span class="chip" data-version-chip><span class="dot"></span>Checking for the latest version</span>' +
          '<a href="#/download">Windows, Mac and Linux</a></div>' +
      '</div>' +
      '<div class="ticket demo" data-demo aria-label="A short example scene">' +
        '<div class="demo-top"><div class="avatar" aria-hidden="true"></div><div><div class="demo-name">' + esc(demo.character) + '</div>' +
          '<div class="demo-role">' + esc(demo.role) + '</div></div><span class="demo-tag">Example</span></div>' +
        '<hr class="perf">' +
        '<div class="demo-body">' +
          '<div class="msg msg-you">' + esc(demo.you) + '</div>' +
          '<div class="msg msg-them" data-reply aria-live="polite"></div>' +
        '</div>' +
        '<div class="swiper">' +
          '<button class="swipe-btn" type="button" data-prev aria-label="Previous reply">' + icon.left + '</button>' +
          '<span class="swipe-count" data-count aria-live="polite">1 / 3</span>' +
          '<button class="swipe-btn" type="button" data-next aria-label="Next reply">' + icon.right + '</button>' +
          '<span class="swipe-hint">Swipe for another reply.<br>Every version stays.</span>' +
        '</div>' +
      '</div>' +
    '</div></section>' +

    '<section class="section section-alt"><div class="wrap">' +
      '<div class="section-head"><p class="eyebrow">Three things you do</p><h2>Play, make, keep.</h2>' +
        '<p>Bunzai is built around the three things roleplay fans already do. It just makes each one a little nicer.</p></div>' +
      '<div class="acts">' +
        act("Act one", "Play scenes", "Chat with any character. Swipe for another reply, or branch the story into takes and try a different path.", "#/features/scenes", "Tour Scenes") +
        act("Act two", "Make things", "Characters, lorebooks and presets, each with an editor that shows what you're doing as you type.", "#/features/workbench", "Tour the Workbench") +
        act("Act three", "Keep your library", "Everything you import or make, as portrait cards. Private, encrypted, and yours to export any time.", "#/features/library", "Tour the Library") +
      '</div>' +
    '</div></section>' +

    '<section class="section"><div class="wrap">' +
      '<div class="promise">' +
        '<div><strong>Free, for real</strong><p>No account, no plan, no ads. The code is open for anyone to read.</p></div>' +
        '<div><strong>Stays on your computer</strong><p>Your library is stored privately and encrypted on your own machine.</p></div>' +
        '<div><strong>Bring your cards</strong><p>Imports from SillyTavern, RoleCall, Chub and other apps.</p></div>' +
        '<div><strong>Never locked in</strong><p>Export to 11 other apps\' formats whenever you like.</p></div>' +
      '</div>' +
    '</div></section>' +

    '<section class="section section-alt"><div class="wrap">' +
      '<div class="section-head"><p class="eyebrow">Take a look around</p><h2>Where to next?</h2></div>' +
      '<div class="linkgrid">' +
        linkcard("#/features", "Feature tour", "Scenes, Workbench, Library, Press and the Agent.") +
        linkcard("#/guides", "Guides and help", "Your first scene, importing cards, backups and more.") +
        linkcard("#/download", "Download", "Pick your system and get going in a minute.") +
        linkcard("#/whats-new", "What's new", "Every release, newest first.") +
        linkcard("#/try", "Try it in your browser", "Open the Studio with nothing to install.") +
      '</div>' +
    '</div></section>';
  }
  function act(num, title, text, href, cta) {
    return '<a class="ticket act" href="' + href + '"><div class="act-top"><span class="act-num">' + num + '</span>' +
      '<h3>' + title + '</h3><p>' + text + '</p></div><hr class="perf"><span class="link-arrow">' + cta + ' ' + icon.arrow + '</span></a>';
  }
  function linkcard(href, t, d) {
    return '<a class="linkcard" href="' + href + '"><strong>' + t + '</strong><span>' + d + '</span></a>';
  }

  function pageFeatures() {
    return '<section class="page-head"><div class="wrap">' +
      '<p class="eyebrow">Feature tour</p><h1 tabindex="-1">Everything Bunzai does, one stop at a time.</h1>' +
      '<p class="lead">Five parts, each with its own job. Pick one to take a closer look.</p></div></section>' +
      '<section class="wrap" style="padding-bottom:48px"><div class="feature-list">' +
      D.features.map(function (f) {
        return '<a class="ticket feature-row" href="#/features/' + f.slug + '"><div class="stub"><small>' + esc(f.kicker) + '</small><b>' + esc(f.name) + '</b></div>' +
          '<p>' + esc(f.short) + '</p><span class="link-arrow">Look closer ' + icon.arrow + '</span></a>';
      }).join("") +
      '</div></section>';
  }

  function pageFeature(slug) {
    var idx = -1;
    D.features.forEach(function (f, i) { if (f.slug === slug) idx = i; });
    if (idx < 0) return null;
    var f = D.features[idx];
    var prev = D.features[idx - 1], next = D.features[idx + 1];
    var guide = D.guides.filter(function (g) { return g.slug === f.guide; })[0];
    return '<section class="page-head"><div class="wrap">' +
      '<p class="crumbs"><a href="#/features">Feature tour</a> / ' + esc(f.name) + '</p>' +
      '<p class="eyebrow">' + esc(f.kicker) + '</p><h1 tabindex="-1">' + esc(f.name) + '</h1>' +
      '<p class="lead">' + esc(f.lead) + '</p></div></section>' +
      '<section class="wrap" style="padding-bottom:48px"><div class="feature-points">' +
      f.points.map(function (p, i) {
        return '<div class="point"><span class="n">' + String(i + 1).padStart(2, "0") + '</span><h3>' + esc(p.t) + '</h3><p>' + esc(p.d) + '</p></div>';
      }).join("") + '</div>' +
      (guide ? '<p class="aside-note">Want step by step help? Read <a href="#/guides/' + guide.slug + '">' + esc(guide.title) + '</a>.</p>' : "") +
      '<nav class="pager" aria-label="More features">' +
        (prev ? '<a href="#/features/' + prev.slug + '"><small>Previous</small><b>' + esc(prev.name) + '</b></a>' : "") +
        (next ? '<a class="next" href="#/features/' + next.slug + '"><small>Next</small><b>' + esc(next.name) + '</b></a>'
              : '<a class="next" href="#/download"><small>Ready?</small><b>Download Bunzai</b></a>') +
      '</nav></section>';
  }

  function pageGuides(query) {
    return '<section class="page-head"><div class="wrap">' +
      '<p class="eyebrow">Guides and help</p><h1 tabindex="-1">How can we help?</h1>' +
      '<p class="lead">Short guides written for people, not programmers.</p>' +
      '<form class="search" role="search" data-search-form><label class="sr" for="q">Search the guides</label>' + icon.search +
      '<input id="q" type="search" autocomplete="off" placeholder="Search, like &quot;backup&quot; or &quot;swipe&quot;" value="' + esc(query) + '"></form>' +
      '<p class="search-status" data-search-status aria-live="polite"></p></div></section>' +
      '<section class="wrap" style="padding-bottom:48px"><div data-guide-list></div></section>';
  }

  function topicsHtml() {
    return '<div class="topics">' + D.guides.map(function (g) {
      return '<a class="topic" href="#/guides/' + g.slug + '"><strong>' + esc(g.title) + '</strong><span>' + esc(g.blurb) + '</span>' +
        '<span class="count">' + g.sections.length + ' short sections</span></a>';
    }).join("") + '</div>';
  }

  function highlight(text, terms) {
    // Split the raw text on the terms, then escape every piece. Nothing unescaped reaches the DOM.
    var pats = terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).filter(Boolean);
    if (!pats.length) return esc(text);
    var re = new RegExp("(" + pats.join("|") + ")", "gi");
    return String(text).split(re).map(function (piece, i) {
      return i % 2 ? "<mark>" + esc(piece) + "</mark>" : esc(piece);
    }).join("");
  }
  function snippet(text, terms) {
    var lower = text.toLowerCase(), at = -1;
    terms.forEach(function (t) { var i = lower.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; });
    if (at < 0 || text.length < 150) return text.length > 150 ? text.slice(0, 150) + "..." : text;
    var start = Math.max(0, at - 50);
    return (start > 0 ? "..." : "") + text.slice(start, start + 150) + "...";
  }
  function searchGuides(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return null;
    var hits = [];
    D.guides.forEach(function (g) {
      g.sections.forEach(function (s) {
        var body = s.p.join(" ");
        var hay = (g.title + " " + s.h + " " + body).toLowerCase();
        if (!terms.every(function (t) { return hay.indexOf(t) >= 0; })) return;
        var score = 0;
        terms.forEach(function (t) {
          if (s.h.toLowerCase().indexOf(t) >= 0) score += 3;
          if (g.title.toLowerCase().indexOf(t) >= 0) score += 2;
          if (body.toLowerCase().indexOf(t) >= 0) score += 1;
        });
        hits.push({ g: g, s: s, body: body, score: score });
      });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return { terms: terms, hits: hits };
  }
  function renderGuideList(q) {
    var list = main.querySelector("[data-guide-list]");
    var status = main.querySelector("[data-search-status]");
    if (!list) return;
    var r = searchGuides(q);
    if (!r) { list.innerHTML = topicsHtml(); status.textContent = ""; return; }
    if (!r.hits.length) {
      status.textContent = "Nothing found for “" + q + "”.";
      list.innerHTML = '<p>Try a simpler word, or browse every topic below.</p>' + topicsHtml();
      return;
    }
    status.textContent = r.hits.length + (r.hits.length === 1 ? " match" : " matches") + " for “" + q + "”";
    list.innerHTML = '<div class="results">' + r.hits.map(function (h) {
      return '<a class="result" href="#/guides/' + h.g.slug + '/' + h.s.id + '"><small>' + esc(h.g.title) + '</small>' +
        '<strong>' + highlight(h.s.h, r.terms) + '</strong><span>' + highlight(snippet(h.body, r.terms), r.terms) + '</span></a>';
    }).join("") + '</div>';
  }

  function pageGuide(slug) {
    var g = D.guides.filter(function (x) { return x.slug === slug; })[0];
    if (!g) return null;
    return '<section class="page-head"><div class="wrap">' +
      '<p class="crumbs"><a href="#/guides">Guides and help</a> / ' + esc(g.title) + '</p>' +
      '<h1 tabindex="-1">' + esc(g.title) + '</h1><p class="lead">' + esc(g.blurb) + '</p></div></section>' +
      '<section class="wrap" style="padding-bottom:48px"><div class="article-grid">' +
      '<nav class="toc" aria-label="On this page"><h2>On this page</h2>' +
        g.sections.map(function (s) { return '<a href="#/guides/' + g.slug + '/' + s.id + '" data-sec="' + s.id + '">' + esc(s.h) + '</a>'; }).join("") +
      '</nav><article class="article">' +
        g.sections.map(function (s) {
          return '<section id="sec-' + s.id + '"><h2>' + esc(s.h) + '</h2>' + s.p.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join("") + '</section>';
        }).join("") +
        '<p class="aside-note">Still stuck? Check <a href="#/guides/something-wrong">Something went wrong</a>, or <a href="#/guides">search all guides</a>.</p>' +
      '</article></div></section>';
  }

  function pageDownload() {
    var others = ["windows", "mac", "linux"].filter(function (k) { return k !== OS; });
    var sys = OS ? D.systems[OS] : null;
    return '<section class="page-head"><div class="wrap">' +
      '<p class="eyebrow">Download</p><h1 tabindex="-1">Get Bunzai</h1>' +
      '<p class="lead">Free for Windows, Mac and Linux. No account needed.</p></div></section>' +
      '<section class="wrap" style="padding-bottom:48px"><div class="dl-grid">' +
      '<div class="ticket dl-main" data-dl-main>' +
        (sys
          ? '<p class="eyebrow">Looks like you\'re on ' + sys.name + '</p><h2>Bunzai for ' + sys.name + '</h2><p class="muted">' + sys.detail + '. ' + sys.file + '.</p>'
          : '<p class="eyebrow">Pick your computer</p><h2>Bunzai is a desktop app</h2><p class="muted">It runs on Windows, Mac and Linux computers. Choose yours from the list.</p>') +
        '<dl class="facts"><div><dt>Version</dt><dd data-version>...</dd></div><div><dt>Released</dt><dd data-date>...</dd></div>' +
          (sys ? '<div><dt>Size</dt><dd data-size-' + OS + '>...</dd></div>' : '') + '</dl>' +
        (sys ? '<a class="btn btn-stamp btn-big" data-href-' + OS + ' href="' + D.releasesPage + '">' + icon.download + '<span>Download for ' + sys.name + '</span></a>' : '') +
        '<p class="sample-flag" data-sample-flag hidden></p>' +
      '</div>' +
      '<div><h2 style="font-size:1.3rem">' + (sys ? "Other systems" : "All systems") + '</h2><div class="others">' +
        (sys ? others : ["windows", "mac", "linux"]).map(function (k) {
          var s = D.systems[k];
          return '<a class="other" data-href-' + k + ' href="' + D.releasesPage + '"><div><strong>' + s.name + '</strong><span>' + s.file + ' <span data-size-' + k + '></span></span></div>' + icon.download + '</a>';
        }).join("") +
        '<a class="other current" href="#/try"><div><strong>No install</strong><span>Try the Studio in your browser</span></div>' + icon.arrow + '</a>' +
      '</div></div></div>' +
      '<div class="note"><h3>If Windows says it doesn\'t recognize the app</h3>' +
        '<p>Bunzai is new, so Windows may show a blue box that says it protected your PC. That is normal for new apps. To continue:</p>' +
        '<ol><li>Click <strong>More info</strong>.</li><li>Click <strong>Run anyway</strong>.</li></ol>' +
        '<p style="margin:12px 0 0">You only need to do this once. On first launch, Bunzai adds itself to your Start menu so it is easy to find again.</p></div>' +
      '</section>';
  }

  function pageWhatsNew() {
    return '<section class="page-head"><div class="wrap">' +
      '<p class="eyebrow">What\'s new</p><h1 tabindex="-1">Every release, newest first</h1>' +
      '<div class="status-line"><span class="chip" data-feed-status><span class="dot"></span>Checking GitHub for releases</span></div></div></section>' +
      '<section class="wrap" style="padding-bottom:48px"><div class="releases" data-releases></div></section>';
  }

  function pageTry() {
    return '<section class="page-head"><div class="wrap">' +
      '<p class="eyebrow">Try it</p><h1 tabindex="-1">Try the Studio in your browser</h1>' +
      '<p class="lead">The Studio is the making side of Bunzai. It runs right in your browser, so you can poke around before you install anything.</p>' +
      '<p><a class="btn btn-stamp btn-big" href="studio/">Open the Studio ' + icon.arrow + '</a></p></div></section>' +
      '<section class="wrap" style="padding-bottom:48px"><div class="try-grid">' +
        '<div class="can"><h3>What works in the browser</h3><ul><li>Make and edit characters, lorebooks and presets.</li><li>Preview macros and prompts as you type.</li></ul></div>' +
        '<div class="cant"><h3>Good to know</h3><ul><li>Your work is kept only while the tab is open. Close it and it is gone, so export anything you want to keep.</li><li>Chatting needs the desktop app.</li></ul>' +
          '<p style="margin:14px 0 0"><a class="link-arrow" href="#/download">Get the app ' + icon.arrow + '</a></p></div>' +
      '</div></section>';
  }

  function pageLost() {
    return '<section class="wrap lost">' + logoSvg + '<h1 tabindex="-1">This ticket doesn\'t open any doors</h1>' +
      '<p class="muted">The page you were looking for isn\'t here.</p><p><a class="btn btn-ghost" href="#/">Back to the start</a></p></section>';
  }

  /* ---------- live data hydration ---------- */
  function hydrate() {
    getReleases().then(function (data) {
      var r = data.list[0];
      var v = versionOf(r);
      main.querySelectorAll("[data-version]").forEach(function (el) { el.textContent = v; });
      document.querySelectorAll(".btn-sub [data-version]").forEach(function (el) { el.textContent = v; });
      main.querySelectorAll("[data-date]").forEach(function (el) { el.textContent = fmtDate(r.published_at); });
      var chip = main.querySelector("[data-version-chip]");
      if (chip) {
        chip.classList.toggle("live", data.live);
        chip.innerHTML = '<span class="dot"></span>Version ' + esc(v) + ' &middot; ' + esc(fmtDate(r.published_at));
      }
      ["windows", "mac", "linux"].forEach(function (k) {
        var info = downloadInfo(data, k);
        main.querySelectorAll("[data-href-" + k + "]").forEach(function (el) { el.setAttribute("href", info.href); });
        main.querySelectorAll("[data-size-" + k + "]").forEach(function (el) {
          var inList = el.tagName === "SPAN";
          el.textContent = info.size ? (inList ? "· " + info.size : info.size) : (inList ? "" : "See release");
        });
      });
      var flag = main.querySelector("[data-sample-flag]");
      if (flag && !data.live) {
        flag.hidden = false;
        flag.textContent = "We couldn't reach GitHub just now, so this shows sample details. The button opens the releases page.";
      }
      var feed = main.querySelector("[data-releases]");
      if (feed) {
        var status = main.querySelector("[data-feed-status]");
        status.classList.toggle("live", data.live);
        status.innerHTML = '<span class="dot"></span>' + (data.live ? "Live from GitHub" : "Showing sample notes. GitHub couldn't be reached.");
        feed.innerHTML = data.list.map(function (rel, i) {
          var title = rel.name && rel.name !== rel.tag_name ? rel.name : "Release " + versionOf(rel);
          return '<article class="ticket release"><div class="release-stub"><span class="v">' + esc(rel.tag_name) + '</span>' +
            '<time datetime="' + esc(rel.published_at) + '">' + esc(fmtDate(rel.published_at)) + '</time>' +
            (i === 0 ? '<span class="latest">Latest</span>' : "") + (rel.prerelease ? '<span class="latest" style="background:var(--gold)">Preview</span>' : "") + '</div>' +
            '<div class="release-body"><h2>' + esc(title) + '</h2>' + renderNotes(rel.body) +
            '<a class="link-arrow" href="' + esc(safeUrl(rel.html_url, D.releasesPage)) + '" rel="noopener">See it on GitHub ' + icon.arrow + '</a></div></article>';
        }).join("");
      }
    });
  }

  /* ---------- demo ---------- */
  var demoTimer = null;
  function setupDemo() {
    var root = main.querySelector("[data-demo]");
    if (!root) return;
    var replies = D.demo.replies, i = 0;
    var box = root.querySelector("[data-reply]"), count = root.querySelector("[data-count]");
    function show(n, typed) {
      i = (n + replies.length) % replies.length;
      count.textContent = (i + 1) + " / " + replies.length;
      clearInterval(demoTimer);
      var text = replies[i];
      if (!typed || reduceMotion.matches) {
        box.textContent = text;
        if (!reduceMotion.matches) { box.classList.remove("fade-in"); void box.offsetWidth; box.classList.add("fade-in"); }
        return;
      }
      var k = 0;
      box.textContent = "";
      var span = document.createElement("span"), caret = document.createElement("span");
      caret.className = "caret";
      box.appendChild(span); box.appendChild(caret);
      demoTimer = setInterval(function () {
        k += 2;
        span.textContent = text.slice(0, k);
        if (k >= text.length) { clearInterval(demoTimer); caret.remove(); }
      }, 22);
    }
    root.querySelector("[data-prev]").addEventListener("click", function () { show(i - 1, false); });
    root.querySelector("[data-next]").addEventListener("click", function () { show(i + 1, true); });
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { show(i - 1, false); e.preventDefault(); }
      if (e.key === "ArrowRight") { show(i + 1, true); e.preventDefault(); }
    });
    var x0 = null;
    box.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) show(dx < 0 ? i + 1 : i - 1, dx < 0);
    });
    show(0, true);
  }

  /* ---------- router ---------- */
  var titles = { "": "Bunzai", features: "Feature tour", guides: "Guides and help", download: "Download", "whats-new": "What's new", try: "Try it" };

  function parse() {
    var h = location.hash.replace(/^#\/?/, "");
    var q = "";
    var qi = h.indexOf("?");
    if (qi >= 0) {
      var m = h.slice(qi + 1).match(/(?:^|&)q=([^&]*)/);
      if (m) { try { q = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { q = ""; } }
      h = h.slice(0, qi);
    }
    var parts = h.split("/").filter(Boolean);
    return { parts: parts, q: q };
  }

  var lastKey = null;
  function route() {
    var r = parse(), p = r.parts, html = null, title = null;
    var top = p[0] || "";
    var key = p.slice(0, 2).join("/");
    // A section link inside the article already on screen: just scroll.
    if (top === "guides" && p[2] && key === lastKey && main.querySelector("#sec-" + CSS.escape(p[2]))) {
      scrollToSection(p[2]); return;
    }
    clearInterval(demoTimer);
    if (!top) { html = pageHome(); title = "Bunzai: AI roleplay on your own computer"; }
    else if (top === "features" && !p[1]) html = pageFeatures();
    else if (top === "features") { html = pageFeature(p[1]); if (html) title = D.features.filter(function (f) { return f.slug === p[1]; })[0].name + " | Bunzai"; }
    else if (top === "guides" && !p[1]) html = pageGuides(r.q);
    else if (top === "guides") { html = pageGuide(p[1]); if (html) title = D.guides.filter(function (g) { return g.slug === p[1]; })[0].title + " | Bunzai"; }
    else if (top === "download" && !p[1]) html = pageDownload();
    else if (top === "whats-new" && !p[1]) html = pageWhatsNew();
    else if (top === "try" && !p[1]) html = pageTry();
    if (html == null) { html = pageLost(); title = "Page not found | Bunzai"; top = ""; }
    main.innerHTML = html;
    document.title = title || (titles[top] ? titles[top] + " | Bunzai" : "Bunzai");
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === top) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    closeMenu();
    lastKey = key;
    hydrate();
    setupDemo();
    setupSearch();
    if (top === "guides" && p[2]) { scrollToSection(p[2]); return; }
    window.scrollTo(0, 0);
    var h1 = main.querySelector("h1");
    if (h1 && navigated) h1.focus({ preventScroll: true });
    navigated = true;
  }
  var navigated = false;

  function scrollToSection(id) {
    var el = main.querySelector("#sec-" + CSS.escape(id));
    if (!el) { window.scrollTo(0, 0); return; }
    el.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
    main.querySelectorAll(".toc a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-sec") === id); });
    main.querySelectorAll(".article section").forEach(function (s) { s.classList.remove("flash"); });
    el.classList.add("flash");
    var h = el.querySelector("h2"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  function setupSearch() {
    var form = main.querySelector("[data-search-form]");
    if (!form) return;
    var input = form.querySelector("input");
    renderGuideList(input.value);
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    input.addEventListener("input", function () {
      var v = input.value;
      history.replaceState(null, "", "#/guides" + (v.trim() ? "?q=" + encodeURIComponent(v) : ""));
      renderGuideList(v);
    });
  }

  /* ---------- menu ---------- */
  var menuBtn = document.querySelector(".menu-btn"), nav = document.getElementById("site-nav");
  function closeMenu() { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
  menuBtn.addEventListener("click", function () {
    var open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  document.querySelector("[data-skip]").addEventListener("click", function (e) {
    e.preventDefault(); var h1 = main.querySelector("h1"); (h1 || main).focus();
  });

  window.addEventListener("hashchange", route);
  route();
})();
