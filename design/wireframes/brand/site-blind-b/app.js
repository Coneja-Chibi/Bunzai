/* Bunraku site: hash router, live releases with sample fallback, OS detection, help search, demo chat. */
(function () {
  "use strict";

  var main = document.getElementById("main");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var OS_NAMES = { windows: "Windows", mac: "Mac", linux: "Linux" };
  var OS_FILES = { windows: /\.(exe|msi)$/i, mac: /\.dmg$/i, linux: /\.(appimage|deb|rpm)$/i };

  /* ---------- Safety helpers ---------- */
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(url) {
    return typeof url === "string" && /^https:\/\/github\.com\/[^\s"'<>]+$/.test(url) ? url : BK.RELEASES_PAGE;
  }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  /* ---------- Releases: one fetch per page load, sample data on any failure ---------- */
  var releasesPromise = null;
  function normalize(r) {
    return {
      tag: String(r.tag_name || ""),
      name: String(r.name || r.tag_name || "Release"),
      date: r.published_at ? new Date(r.published_at) : null,
      body: String(r.body || ""),
      url: safeUrl(r.html_url),
      assets: (Array.isArray(r.assets) ? r.assets : []).map(function (a) {
        return { name: String(a.name || ""), size: Number(a.size) || 0, url: safeUrl(a.browser_download_url) };
      })
    };
  }
  function sample() { return { live: false, list: BK.SAMPLE_RELEASES.map(normalize) }; }
  function getReleases() {
    if (releasesPromise) return releasesPromise;
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
    releasesPromise = fetch("https://api.github.com/repos/" + BK.REPO + "/releases?per_page=30", {
      headers: { Accept: "application/vnd.github+json" },
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then(function (data) {
        var list = (Array.isArray(data) ? data : []).filter(function (r) { return r && !r.draft; }).map(normalize);
        return list.length ? { live: true, list: list } : sample();
      })
      .catch(function () { return sample(); })
      .then(function (result) { clearTimeout(timer); return result; });
    return releasesPromise;
  }

  /* ---------- Formatting ---------- */
  function fmtDate(d) {
    if (!d || isNaN(d)) return "Date unknown";
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  function fmtSize(bytes) {
    if (!bytes) return "Size unknown";
    return (bytes / 1048576).toFixed(1) + " MB";
  }
  /* Escape first, then apply a tiny subset of Markdown. */
  function notes(body) {
    var out = [], list = [];
    function flush() { if (list.length) { out.push("<ul>" + list.join("") + "</ul>"); list = []; } }
    body.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      var m = line.match(/^[-*]\s+(.*)$/);
      if (m) { list.push("<li>" + esc(m[1]) + "</li>"); return; }
      flush();
      var h = line.match(/^#{1,6}\s+(.*)$/);
      if (h) out.push("<p><strong>" + esc(h[1]) + "</strong></p>");
      else if (line) out.push("<p>" + esc(line) + "</p>");
    });
    flush();
    return out.join("") || "<p class=\"muted\">No notes for this one.</p>";
  }

  /* ---------- OS detection ---------- */
  function detectOS() {
    var uad = navigator.userAgentData;
    var ua = navigator.userAgent || "";
    var p = (uad && uad.platform) || navigator.platform || "";
    if ((uad && uad.mobile) || /android|iphone|ipad|ipod/i.test(ua)) return "mobile";
    if (/win/i.test(p) || /windows/i.test(ua)) return "windows";
    if (/mac/i.test(p) || /mac os x/i.test(ua)) return navigator.maxTouchPoints > 1 ? "mobile" : "mac";
    if (/linux|cros|x11/i.test(p + " " + ua)) return "linux";
    return "unknown";
  }
  var userOS = detectOS();
  function assetFor(rel, os) {
    var re = OS_FILES[os];
    var found = rel && re ? rel.assets.filter(function (a) { return re.test(a.name); })[0] : null;
    return found || { name: "", size: 0, url: rel ? rel.url : BK.RELEASES_PAGE };
  }

  /* ---------- Small pieces ---------- */
  var ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  var ICON_LEFT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
  var ICON_RIGHT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';

  function sourceNote(live) {
    return live
      ? "Release info read from GitHub just now."
      : "Showing sample release info. The real list appears here once releases are published on GitHub.";
  }

  /* ---------- Pages ---------- */
  function home() {
    var pillars = BK.PILLARS.map(function (p, i) {
      return '<a class="ticket notched card stub" href="' + p.route + '">' +
        '<div class="stub-top"><span class="admit">Admit one</span><span class="stub-num">0' + (i + 1) + "</span></div>" +
        '<div class="stub-body perf"><h3>' + esc(p.title) + "</h3><p>" + esc(p.text) + '</p><span class="go">See how</span></div></a>';
    }).join("");
    var d = BK.DEMO;
    return {
      title: "Bunraku: roleplay with AI characters on your own computer",
      html:
        '<div class="wrap hero">' +
          "<div>" +
            '<p class="eyebrow">Free for Windows, Mac and Linux</p>' +
            '<h1 tabindex="-1">Your characters, <em>your stories</em>, your computer.</h1>' +
            '<p class="lede">Bunraku is a free app for playing and making AI roleplay characters. Everything stays private and encrypted on your own machine.</p>' +
            '<div class="hero-cta">' +
              '<a class="btn btn-big" href="#/download" data-dl-button>' + dlLabel() + "</a>" +
              '<a class="btn btn-ghost btn-big" href="#/try">Try it in your browser</a>' +
            "</div>" +
            '<p class="dl-meta" data-version>Checking for the latest version...</p>' +
          "</div>" +
          '<div class="ticket notched demo" aria-label="A short example scene">' +
            '<div class="demo-head"><span class="avatar" aria-hidden="true">W</span><div><strong>' + esc(d.character) + "</strong><span>" + esc(d.role) + "</span></div></div>" +
            '<div class="demo-body perf">' +
              '<p class="msg msg-user">' + esc(d.user) + "</p>" +
              '<p class="msg msg-char" data-reply aria-hidden="true"></p>' +
              '<p class="sr-only" aria-live="polite" data-reply-live></p>' +
            "</div>" +
            '<div class="swipe-bar">' +
              '<button type="button" data-swipe="-1" aria-label="Previous reply">' + ICON_LEFT + "</button>" +
              '<span class="swipe-count" data-count>1 / ' + d.replies.length + "</span>" +
              '<button type="button" data-swipe="1" aria-label="Next reply">' + ICON_RIGHT + "</button>" +
              '<span class="swipe-hint">Swipe, or use the arrows</span>' +
            "</div>" +
            '<p class="demo-note perf">A pre-written example. In the app, your own AI key writes the replies.</p>' +
          "</div>" +
        "</div>" +
        '<div class="band"><div class="wrap facts">' +
          "<div><strong>Stays on your computer</strong><span>No account. Your library never leaves your machine unless you send it.</span></div>" +
          "<div><strong>Encrypted, always</strong><span>Characters, worlds, and chats are stored privately and encrypted.</span></div>" +
          "<div><strong>Comes and goes freely</strong><span>Bring cards from SillyTavern, RoleCall, Chub and more. Export to 11 other apps.</span></div>" +
        "</div></div>" +
        '<section class="section"><div class="wrap">' +
          '<p class="eyebrow">Three things you do</p><h2>Play, make, keep.</h2>' +
          '<div class="grid grid-3" style="margin-top:28px">' + pillars + "</div>" +
        "</div></section>" +
        '<section class="section"><div class="wrap">' +
          "<h2>Where to next</h2>" +
          '<div class="links" style="margin-top:20px">' +
            '<a class="ticket card" href="#/tour"><strong>Take the tour</strong><span>Every feature, one page each.</span></a>' +
            '<a class="ticket card" href="#/guides"><strong>Guides and help</strong><span>Friendly how-tos, searchable.</span></a>' +
            '<a class="ticket card" href="#/download"><strong>Download</strong><span>For Windows, Mac and Linux.</span></a>' +
            '<a class="ticket card" href="#/whats-new"><strong>What\'s new</strong><span>Every release, newest first.</span></a>' +
            '<a class="ticket card" href="#/try"><strong>Try it</strong><span>The Studio, right in your browser.</span></a>' +
          "</div>" +
        "</div></section>",
      after: function (alive) {
        initDemo();
        getReleases().then(function (res) {
          if (!alive()) return;
          var rel = res.list[0];
          var btn = main.querySelector("[data-dl-button]");
          if (OS_NAMES[userOS]) btn.href = assetFor(rel, userOS).url;
          main.querySelector("[data-version]").innerHTML =
            "Version " + esc(rel.tag) + ", released " + esc(fmtDate(rel.date)) +
            (res.live ? "" : " (sample info)") +
            '. <span class="nowrap"><a href="#/download">Other systems</a> · <a href="#/whats-new">What\'s new</a></span>';
        });
      }
    };
  }
  function dlLabel() {
    return OS_NAMES[userOS] ? "Download for " + OS_NAMES[userOS] : "Get Bunraku";
  }

  function tourIndex() {
    var cards = BK.FEATURES.map(function (f) {
      return '<a class="ticket card" href="#/tour/' + f.slug + '"><p class="eyebrow">' + esc(f.tagline) + "</p><h3>" + esc(f.name) +
        "</h3><p>" + esc(f.intro) + '</p><span class="go">See how it works</span></a>';
    }).join("");
    return {
      title: "Feature tour",
      html:
        '<div class="wrap page-head"><p class="eyebrow">Feature tour</p><h1 tabindex="-1">What Bunraku can do</h1>' +
        "<p>Five parts, each with a job. Play in Scenes, make things in the Workbench, keep them in the Library, send them out with Press, and get help from the Agent.</p></div>" +
        '<div class="wrap section" style="padding-top:0"><div class="links wide">' + cards + "</div></div>"
    };
  }

  function sideNav(title, items, current) {
    return '<nav class="side" aria-label="' + esc(title) + '"><p class="side-title">' + esc(title) + "</p>" +
      items.map(function (it) {
        return '<a href="' + it.href + '"' + (it.key === current ? ' aria-current="page"' : "") + ">" + esc(it.label) + "</a>";
      }).join("") + "</nav>";
  }

  function feature(slug) {
    var i = BK.FEATURES.findIndex(function (f) { return f.slug === slug; });
    if (i < 0) return notFound();
    var f = BK.FEATURES[i];
    var prev = BK.FEATURES[i - 1], next = BK.FEATURES[i + 1];
    var guide = BK.GUIDES.filter(function (g) { return g.slug === f.guide; })[0];
    var nav = sideNav("Feature tour", BK.FEATURES.map(function (x) { return { href: "#/tour/" + x.slug, label: x.name, key: x.slug }; }), slug);
    var pts = f.points.map(function (p, n) {
      return '<li class="ticket"><span class="n">' + (n + 1) + "</span><div><h3>" + esc(p[0]) + "</h3><p>" + esc(p[1]) + "</p></div></li>";
    }).join("");
    return {
      title: f.name + " | Feature tour",
      html:
        '<div class="wrap page-head"><p class="crumbs"><a href="#/tour">Feature tour</a></p><p class="eyebrow">' + esc(f.tagline) + '</p><h1 tabindex="-1">' + esc(f.name) + "</h1><p>" + esc(f.intro) + "</p></div>" +
        '<div class="wrap feature-layout">' + nav + "<div>" +
          '<ol class="points">' + pts + "</ol>" +
          (guide ? '<p>Want the details? Read <a href="#/guides/' + guide.slug + '">' + esc(guide.title) + "</a> in Guides.</p>" : "") +
          '<div class="pager">' +
            (prev ? '<a class="btn btn-ghost" href="#/tour/' + prev.slug + '">Back: ' + esc(prev.name) + "</a>" : "<span></span>") +
            (next ? '<a class="btn btn-ghost" href="#/tour/' + next.slug + '">Next: ' + esc(next.name) + "</a>" : '<a class="btn" href="#/download">Download Bunraku</a>') +
          "</div>" +
        "</div></div>"
    };
  }

  /* ---------- Help search ---------- */
  var searchIndex = [];
  BK.GUIDES.forEach(function (g) {
    g.sections.forEach(function (s) {
      var text = s[2].join(" ");
      searchIndex.push({ guide: g, id: s[0], heading: s[1], text: text, hay: (g.title + " " + s[1] + " " + text).toLowerCase() });
    });
  });
  function highlight(text, words) {
    if (!words.length) return esc(text);
    var re = new RegExp("(" + words.map(reEsc).join("|") + ")", "gi");
    return text.split(re).map(function (part, i) { return i % 2 ? "<mark>" + esc(part) + "</mark>" : esc(part); }).join("");
  }
  function snippet(text, words) {
    if (text.length <= 170) return text;
    var at = Math.max(0, text.toLowerCase().indexOf(words[0] || "") - 50);
    var cut = text.slice(at, at + 170);
    return (at > 0 ? "..." : "") + cut + (at + 170 < text.length ? "..." : "");
  }
  function runSearch(q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    var hits = searchIndex.filter(function (e) { return words.every(function (w) { return e.hay.indexOf(w) >= 0; }); }).slice(0, 12);
    if (!hits.length) {
      return '<li class="ticket empty">Nothing matched “' + esc(q) + '”. Try a simpler word, or look in <a href="#/guides/trouble">Something went wrong</a>.</li>';
    }
    return hits.map(function (h) {
      return '<li><a class="ticket" href="#/guides/' + h.guide.slug + "/" + h.id + '"><span class="where">' + esc(h.guide.title) +
        "</span><h3>" + highlight(h.heading, words) + "</h3><p>" + highlight(snippet(h.text, words), words) + "</p></a></li>";
    }).join("");
  }

  function guides(query) {
    var cards = BK.GUIDES.map(function (g) {
      return '<a class="ticket card" href="#/guides/' + g.slug + '"><h3>' + esc(g.title) + "</h3><p>" + esc(g.summary) + '</p><span class="go">' + g.sections.length + " sections</span></a>";
    }).join("");
    return {
      title: "Guides and help",
      html:
        '<div class="wrap page-head"><p class="eyebrow">Guides and help</p><h1 tabindex="-1">How can we help?</h1>' +
        '<form class="search" role="search" data-search-form><label class="sr-only" for="q">Search the guides</label>' + ICON_SEARCH +
        '<input id="q" type="search" placeholder="Search, for example: backup, swipe, lorebook" autocomplete="off" value="' + esc(query) + '"></form>' +
        '<ul class="results" data-results aria-live="polite"></ul></div>' +
        '<div class="wrap section" style="padding-top:12px"><h2>All topics</h2><div class="links" style="margin-top:20px">' + cards + "</div></div>",
      after: function () {
        var input = main.querySelector("#q");
        var out = main.querySelector("[data-results]");
        function update() {
          out.innerHTML = runSearch(input.value);
          try { history.replaceState(null, "", "#/guides" + (input.value ? "?q=" + encodeURIComponent(input.value) : "")); } catch (e) { /* file:// may refuse */ }
        }
        input.addEventListener("input", update);
        main.querySelector("[data-search-form]").addEventListener("submit", function (e) { e.preventDefault(); update(); });
        if (query) out.innerHTML = runSearch(query);
      }
    };
  }

  function article(slug, section) {
    var i = BK.GUIDES.findIndex(function (g) { return g.slug === slug; });
    if (i < 0) return notFound();
    var g = BK.GUIDES[i], prev = BK.GUIDES[i - 1], next = BK.GUIDES[i + 1];
    var toc = sideNav("On this page", g.sections.map(function (s) { return { href: "#/guides/" + g.slug + "/" + s[0], label: s[1], key: s[0] }; }), section);
    var body = g.sections.map(function (s) {
      return '<section id="sec-' + s[0] + '"><h2 tabindex="-1">' + esc(s[1]) + "</h2>" + s[2].map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</section>";
    }).join("");
    return {
      title: g.title + " | Guides",
      focus: g.sections.some(function (s) { return s[0] === section; }) ? "#sec-" + section + " h2" : null,
      html:
        '<div class="wrap page-head"><p class="crumbs"><a href="#/guides">Guides and help</a></p><h1 tabindex="-1">' + esc(g.title) + "</h1><p>" + esc(g.summary) + "</p></div>" +
        '<div class="wrap article">' + toc + "<div>" + body +
          '<div class="pager" style="margin-top:32px">' +
            (prev ? '<a class="btn btn-ghost" href="#/guides/' + prev.slug + '">Back: ' + esc(prev.title) + "</a>" : "<span></span>") +
            (next ? '<a class="btn btn-ghost" href="#/guides/' + next.slug + '">Next: ' + esc(next.title) + "</a>" : '<a class="btn btn-ghost" href="#/guides">All topics</a>') +
          "</div>" +
        "</div></div>"
    };
  }

  function download() {
    var isDesktop = !!OS_NAMES[userOS];
    return {
      title: "Download Bunraku",
      html:
        '<div class="wrap page-head"><p class="eyebrow">Download</p><h1 tabindex="-1">' +
          (isDesktop ? "Bunraku for " + OS_NAMES[userOS] : "Bunraku is a desktop app") + "</h1>" +
          "<p>" + (isDesktop
            ? "We picked this for your computer. Free, no account, no sign-up."
            : "It runs on Windows, Mac and Linux computers. Pick yours below, or try the Studio in your browser for now.") + "</p></div>" +
        '<div class="wrap" data-dl><p class="muted">Checking for the latest version...</p></div>' +
        '<div class="wrap section" style="padding-top:28px"><div class="grid grid-2">' +
          '<div class="ticket note"><h3>If Windows says it doesn\'t recognize this app</h3>' +
            "<p>Windows shows a blue box for new apps it hasn't seen much yet. It's fine. To carry on:</p>" +
            "<ol><li>Choose <strong>More info</strong>.</li><li>Choose <strong>Run anyway</strong>.</li></ol></div>" +
          '<div class="ticket note"><h3>After it opens</h3>' +
            "<p>On first launch, Bunraku adds itself to your Start menu, so you can find it again next time.</p>" +
            '<p>New here? Start with <a href="#/guides/first-scene">Your first scene</a>.</p></div>' +
        "</div></div>",
      after: function (alive) {
        getReleases().then(function (res) {
          if (!alive()) return;
          var rel = res.list[0];
          var others = ["windows", "mac", "linux"].filter(function (os) { return os !== userOS || !isDesktop; });
          var list = others.map(function (os) {
            var a = assetFor(rel, os);
            return '<li class="ticket"><div><div class="os-name">' + OS_NAMES[os] + '</div><div class="os-file">' +
              esc(a.name || "See the release page") + (a.size ? ", " + esc(fmtSize(a.size)) : "") + "</div></div>" +
              '<a class="btn btn-ghost btn-small" href="' + esc(a.url) + '" rel="noopener">Download</a></li>';
          }).join("");
          var mainCard = "";
          if (isDesktop) {
            var a = assetFor(rel, userOS);
            mainCard = '<div class="ticket notched dl-main"><div>' +
              '<a class="btn btn-big" href="' + esc(a.url) + '" rel="noopener">Download for ' + OS_NAMES[userOS] + "</a>" +
              '<dl class="meta-list" style="margin-top:24px">' +
                "<dt>Version</dt><dd>" + esc(rel.tag) + "</dd>" +
                "<dt>Released</dt><dd>" + esc(fmtDate(rel.date)) + "</dd>" +
                "<dt>File size</dt><dd>" + esc(fmtSize(a.size)) + "</dd>" +
                "<dt>File</dt><dd style=\"overflow-wrap:anywhere\">" + esc(a.name || "On the release page") + "</dd>" +
              "</dl></div>" +
              '<div class="dl-side"><h3>Other systems</h3><ul class="os-list">' + list + "</ul></div></div>";
          } else {
            mainCard = '<ul class="os-list">' + list + '</ul><p style="margin-top:20px"><a class="btn" href="#/try">Try the Studio in your browser</a></p>';
          }
          main.querySelector("[data-dl]").innerHTML = mainCard +
            '<p class="source">' + esc(sourceNote(res.live)) + ' <a href="#/whats-new">See what\'s new</a>.</p>';
        });
      }
    };
  }

  function whatsNew() {
    return {
      title: "What's new",
      html:
        '<div class="narrow page-head"><p class="eyebrow">What\'s new</p><h1 tabindex="-1">Every release, newest first</h1>' +
        "<p>Small, steady updates. The app tells you when a new one is ready.</p></div>" +
        '<div class="narrow section" style="padding-top:0" data-releases><p class="muted">Loading releases...</p></div>',
      after: function (alive) {
        getReleases().then(function (res) {
          if (!alive()) return;
          var items = res.list.map(function (r, i) {
            return '<li class="ticket release"><div class="release-side"><span class="tag">' + esc(r.tag) + "</span><time>" + esc(fmtDate(r.date)) + "</time>" +
              (i === 0 ? '<span><span class="stamp">Latest</span></span>' : "") + "</div>" +
              '<div class="release-main"><h2>' + esc(r.name) + "</h2>" + notes(r.body) + "</div></li>";
          }).join("");
          main.querySelector("[data-releases]").innerHTML = '<ol class="releases">' + items + '</ol><p class="source">' + esc(sourceNote(res.live)) +
            ' <a href="' + esc(BK.RELEASES_PAGE) + '" rel="noopener">All releases on GitHub</a>.</p>';
        });
      }
    };
  }

  function tryIt() {
    return {
      title: "Try Bunraku in your browser",
      html:
        '<div class="wrap page-head"><p class="eyebrow">Try it</p><h1 tabindex="-1">The Studio, right in your browser</h1>' +
        "<p>Want a look before you install? The Studio runs in your browser. No download, no account.</p></div>" +
        '<div class="wrap section try" style="padding-top:0">' +
          "<div>" +
            '<ul class="checks">' +
              "<li>" + ICON_CHECK + "<span><strong>Editing only.</strong> Make and change characters, worlds, and presets.</span></li>" +
              "<li>" + ICON_CHECK + "<span><strong>Kept only while the tab is open.</strong> Close it and your work is gone, so export anything you want to keep.</span></li>" +
              "<li>" + ICON_CHECK + "<span><strong>Chatting needs the app.</strong> Scenes run on your computer with your own AI key.</span></li>" +
            "</ul>" +
            '<a class="btn btn-big" href="studio/">Open the Studio</a>' +
          "</div>" +
          '<div class="ticket notched card"><p class="admit">When you want to play</p><h3 style="margin-top:10px">Get the full app</h3>' +
            "<p>Scenes, swipes, takes, your library, and everything saved safely on your computer.</p>" +
            '<p style="margin-top:18px"><a class="btn" href="#/download">' + dlLabel() + "</a></p></div>" +
        "</div>"
    };
  }

  function notFound() {
    return {
      title: "Page not found",
      html: '<div class="narrow page-head"><p class="eyebrow">Lost ticket</p><h1 tabindex="-1">We couldn\'t find that page</h1>' +
        '<p>It may have moved. Try the home page or the guides.</p><p><a class="btn" href="#/">Go home</a> <a class="btn btn-ghost" href="#/guides">Guides</a></p></div>'
    };
  }

  /* ---------- Demo chat ---------- */
  var demoTimer = null;
  function initDemo() {
    var reply = main.querySelector("[data-reply]");
    var live = main.querySelector("[data-reply-live]");
    var count = main.querySelector("[data-count]");
    var replies = BK.DEMO.replies;
    var idx = 0;
    function show(n) {
      idx = (n + replies.length) % replies.length;
      var text = replies[idx];
      count.textContent = idx + 1 + " / " + replies.length;
      live.textContent = "Reply " + (idx + 1) + " of " + replies.length + ". " + text;
      clearInterval(demoTimer);
      if (reduceMotion.matches) { reply.textContent = text; return; }
      var shown = 0;
      reply.innerHTML = '<span class="caret"></span>';
      demoTimer = setInterval(function () {
        shown = Math.min(text.length, shown + 3);
        reply.innerHTML = esc(text.slice(0, shown)) + (shown < text.length ? '<span class="caret"></span>' : "");
        if (shown >= text.length) clearInterval(demoTimer);
      }, 18);
    }
    main.querySelectorAll("[data-swipe]").forEach(function (b) {
      b.addEventListener("click", function () { show(idx + Number(b.getAttribute("data-swipe"))); });
    });
    var startX = null;
    reply.addEventListener("pointerdown", function (e) { startX = e.clientX; });
    reply.addEventListener("pointerup", function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1));
    });
    show(0);
  }

  /* ---------- Router ---------- */
  var navToken = 0;
  function route() {
    var raw = location.hash.replace(/^#\/?/, "");
    var q = "";
    var qi = raw.indexOf("?");
    if (qi >= 0) {
      var m = raw.slice(qi + 1).match(/(?:^|&)q=([^&]*)/);
      try { q = m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : ""; } catch (e) { q = ""; }
      raw = raw.slice(0, qi);
    }
    var parts = raw.split("/").filter(Boolean);
    var page;
    switch (parts[0] || "") {
      case "": page = home(); break;
      case "tour": page = parts[1] ? feature(parts[1]) : tourIndex(); break;
      case "guides": page = parts[1] ? article(parts[1], parts[2]) : guides(q); break;
      case "download": page = download(); break;
      case "whats-new": page = whatsNew(); break;
      case "try": page = tryIt(); break;
      default: page = notFound();
    }
    clearInterval(demoTimer);
    var token = ++navToken;
    main.innerHTML = page.html;
    document.title = page.title === "Bunraku" || /^Bunraku/.test(page.title) ? page.title : page.title + " | Bunraku";
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === (parts[0] || "")) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    closeMenu();
    if (page.after) page.after(function () { return token === navToken; });
    var target = page.focus ? main.querySelector(page.focus) : null;
    if (target) {
      target.parentNode.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, 0);
      var h1 = main.querySelector("h1");
      if (h1 && document.readyState === "complete") h1.focus({ preventScroll: true });
    }
  }

  /* ---------- Chrome: menu and skip link ---------- */
  var menuBtn = document.querySelector(".menu-btn");
  var nav = document.getElementById("site-nav");
  function closeMenu() { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
  menuBtn.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  document.querySelector("[data-skip]").addEventListener("click", function (e) { e.preventDefault(); main.focus(); });

  window.addEventListener("hashchange", route);
  route();
  getReleases();
})();
