/* Bunzai site prototype: router, views, live releases, OS detection, search.
 * Static only (GitHub Pages). Hash routes so deep links work without a server.
 */
(function () {
  "use strict";

  const B = window.BUNZAI;
  const app = document.getElementById("app");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ================================================================ */
  /* Small helpers                                                    */
  /* ================================================================ */
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const byId = (list, slug) => list.find((x) => x.slug === slug);

  function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return "";
    const mb = bytes / 1048576;
    return mb >= 1 ? Math.round(mb) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  function fmtDate(d) {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  function relTime(d) {
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return days + " days ago";
    if (days < 14) return "last week";
    if (days < 31) return Math.floor(days / 7) + " weeks ago";
    if (days < 60) return "last month";
    if (days < 365) return Math.floor(days / 30) + " months ago";
    return fmtDate(d);
  }

  function storageGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, val) {
    try { window.sessionStorage.setItem(key, val); } catch (e) { /* private mode: fine */ }
  }

  /* The ticket mark, drawn once in index.html as <symbol id="mark">. */
  const mark = (cls, label) =>
    '<svg class="' + (cls || "mark") + '" viewBox="0 0 120 72" ' +
    (label ? 'role="img" aria-label="' + esc(label) + '"' : 'aria-hidden="true"') +
    '><use href="#mark"/></svg>';

  /* ================================================================ */
  /* OS detection                                                     */
  /* ================================================================ */
  const OS_NAMES = { windows: "Windows", mac: "Mac", linux: "Linux" };
  const os = { family: "unknown", arch: null, forced: false };

  (function detectOS() {
    const forced = new URLSearchParams(location.search).get("os");
    if (forced && /^(windows|mac|linux|mobile)$/.test(forced)) {
      os.family = forced;
      os.forced = true;
      return;
    }
    const uaData = navigator.userAgentData;
    const ua = navigator.userAgent.toLowerCase();
    const plat = ((uaData && uaData.platform) || navigator.platform || "").toLowerCase();
    const touchMac = /mac/.test(plat) && navigator.maxTouchPoints > 1; // iPad asking for desktop pages
    if ((uaData && uaData.mobile) || /android|iphone|ipad|ipod/.test(ua) || touchMac) os.family = "mobile";
    else if (/win/.test(plat) || /windows/.test(ua)) os.family = "windows";
    else if (/mac/.test(plat) || /mac os x/.test(ua)) os.family = "mac";
    else if (/linux|x11|cros/.test(plat) || /linux|x11|cros/.test(ua)) os.family = "linux";

    // Chromium can tell Apple silicon from Intel. Others default to Apple silicon.
    if (os.family === "mac" && uaData && uaData.getHighEntropyValues) {
      uaData.getHighEntropyValues(["architecture"]).then((v) => {
        os.arch = v.architecture === "x86" ? "x64" : "arm64";
        refreshData();
      }).catch(() => {});
    }
  })();

  /* ================================================================ */
  /* Releases: live from GitHub, sample fallback                      */
  /* ================================================================ */
  const API = "https://api.github.com/repos/" + B.repo + "/releases?per_page=30";
  const RELEASES_PAGE = "https://github.com/" + B.repo + "/releases";
  const CACHE_KEY = "bunzai.releases.v1";
  const CACHE_MS = 10 * 60 * 1000;

  const releases = { state: "loading", list: [], reason: "" };

  function classifyAsset(a) {
    const n = a.name.toLowerCase();
    if (/\.(blockmap|yml|yaml|sig|sha256|txt|asc)$/.test(n) || /checksum|latest/.test(n)) return null;
    let family = null, arch = null, kind = "";
    if (/\.(exe|msi)$/.test(n) || /win(dows)?[-_.]/.test(n)) { family = "windows"; kind = n.endsWith(".msi") ? "Installer (.msi)" : "Installer (.exe)"; }
    else if (/\.dmg$|\.pkg$|mac|darwin|osx/.test(n)) { family = "mac"; kind = "Disk image (.dmg)"; }
    else if (/\.appimage$|\.deb$|\.rpm$|\.tar\.gz$|linux/.test(n)) {
      family = "linux";
      kind = n.endsWith(".deb") ? "Debian, Ubuntu (.deb)" : n.endsWith(".rpm") ? "Fedora (.rpm)" : n.endsWith(".appimage") ? "AppImage, most systems" : "Archive (.tar.gz)";
    }
    if (!family) return null;
    if (/arm64|aarch64|apple|silicon/.test(n)) arch = "arm64";
    else if (/x64|x86_64|amd64|intel/.test(n)) arch = "x64";
    if (family === "mac") kind = arch === "x64" ? "Intel Mac (.dmg)" : arch === "arm64" ? "Apple silicon (.dmg)" : kind;
    return { family, arch, kind, name: a.name, size: a.size, url: a.browser_download_url || a.url };
  }

  function normalize(raw) {
    return raw
      .filter((r) => !r.draft)
      .map((r) => {
        const version = String(r.tag_name || r.name || "").replace(/^v/i, "");
        return {
          version,
          title: r.name && r.name.replace(/^v/i, "") !== version ? r.name : "",
          date: new Date(r.published_at || r.created_at || Date.now()),
          notes: r.body || "",
          url: r.html_url || RELEASES_PAGE,
          prerelease: !!r.prerelease,
          assets: (r.assets || []).map(classifyAsset).filter(Boolean),
        };
      })
      .sort((a, b) => b.date - a.date);
  }

  async function loadReleases() {
    const cached = storageGet(CACHE_KEY);
    if (cached) {
      try {
        const c = JSON.parse(cached);
        if (Date.now() - c.at < CACHE_MS && Array.isArray(c.data) && c.data.length) {
          releases.list = normalize(c.data);
          releases.state = "live";
          return;
        }
      } catch (e) { /* ignore a bad cache entry */ }
    }
    const ctrl = "AbortController" in window ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 8000);
    try {
      const res = await fetch(API, { headers: { Accept: "application/vnd.github+json" }, signal: ctrl ? ctrl.signal : undefined });
      if (!res.ok) {
        const limited = res.status === 403 || res.status === 429;
        throw new Error(limited ? "GitHub asked us to slow down (rate limit)" : "GitHub answered " + res.status);
      }
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("GitHub sent something unexpected");
      const list = normalize(data);
      if (!list.length) throw new Error("No releases are published yet");
      releases.list = list;
      releases.state = "live";
      storageSet(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
    } catch (err) {
      releases.list = normalize(B.sampleReleases());
      releases.state = "sample";
      releases.reason = err && err.name === "AbortError" ? "GitHub took too long to answer" : (err && err.message) || "GitHub could not be reached";
    } finally {
      clearTimeout(timer);
    }
  }

  const latest = () => releases.list.find((r) => !r.prerelease) || releases.list[0];

  function pickAsset(rel, family, arch) {
    if (!rel) return null;
    const list = rel.assets.filter((a) => a.family === family);
    if (!list.length) return null;
    if (family === "mac") return list.find((a) => a.arch === (arch || "arm64")) || list[0];
    if (family === "linux") return list.find((a) => /appimage/i.test(a.name)) || list[0];
    return list.find((a) => /\.exe$/i.test(a.name)) || list[0];
  }

  function sourceNote(compact) {
    if (releases.state === "loading") return '<span class="src src--loading">Checking GitHub for the latest release</span>';
    if (releases.state === "live") return '<span class="src src--live">Live from GitHub releases</span>';
    return '<span class="src src--sample">Showing sample releases' + (compact ? "" : ". " + esc(releases.reason) + ".") + "</span>";
  }

  /* Tiny, safe Markdown for release notes: escape first, then a few rules. */
  function md(src) {
    const inline = (t) =>
      esc(t)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i class=\"aside\">$2</i>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
    const out = [];
    let list = null;
    const flush = () => { if (list) { out.push("<ul>" + list.join("") + "</ul>"); list = null; } };
    String(src).replace(/\r/g, "").split("\n").forEach((line) => {
      const l = line.trim();
      let m;
      if (!l) { flush(); return; }
      if ((m = l.match(/^[-*+]\s+(.*)$/))) { (list = list || []).push("<li>" + inline(m[1]) + "</li>"); return; }
      flush();
      if ((m = l.match(/^#{1,6}\s+(.*)$/))) out.push("<h4>" + inline(m[1]) + "</h4>");
      else out.push("<p>" + inline(l) + "</p>");
    });
    flush();
    return out.join("") || "<p>No notes for this release.</p>";
  }

  /* ================================================================ */
  /* Shared pieces                                                    */
  /* ================================================================ */
  const hero = (eyebrow, titleHtml, line, accent) =>
    '<header class="page-hero" style="--acc: var(--acc-' + (accent || "rose") + ')">' +
    '<p class="eyebrow">' + eyebrow + "</p>" +
    '<h1 class="marquee" tabindex="-1">' + titleHtml + "</h1>" +
    (line ? '<p class="serif">' + line + "</p>" : "") +
    "</header>";

  const actBreak = (label) => '<div class="act-break" role="presentation"><span>' + label + "</span></div>";

  function downloadButton(size) {
    const rel = latest();
    const fam = os.family;
    const known = fam === "windows" || fam === "mac" || fam === "linux";
    const asset = known ? pickAsset(rel, fam, os.arch) : null;
    const label = known ? "Download for " + OS_NAMES[fam] : "See all downloads";
    const href = asset ? asset.url : "#/download";
    const meta = rel
      ? "Version " + esc(rel.version) + " · " + relTime(rel.date) + (asset ? " · " + fmtSize(asset.size) : "")
      : "Finding the latest version";
    return (
      '<div class="dl-cta' + (size === "lg" ? " dl-cta--lg" : "") + '">' +
      '<a class="btn btn--rose' + (size === "lg" ? " btn--lg" : "") + '" href="' + esc(href) + '"' +
      (asset && !/^#/.test(href) ? " download" : "") + ">" + label + ' <span aria-hidden="true">&darr;</span></a>' +
      '<p class="dl-meta" aria-live="polite">' + meta + "</p>" +
      (fam === "mobile" ? '<p class="dl-meta">Bunzai runs on computers. Open this page on Windows, Mac, or Linux to download.</p>' : "") +
      "</div>"
    );
  }

  /* ================================================================ */
  /* HOME                                                             */
  /* ================================================================ */
  const DEMO = {
    name: "Wren",
    role: "The night-shift librarian",
    greeting:
      "<i class=\"aside\">The lamp on the reference desk flickers as you come in out of the rain.</i> We close at midnight, you know. But I suppose some books can't wait.",
    user: "I'm looking for something about lighthouses. And maybe somewhere to dry off.",
    swipes: [
      "Lighthouses. Third floor, under the window that leaks. <i class=\"aside\">She slides a towel across the desk.</i> I keep these for regulars. You'll be one soon.",
      "<i class=\"aside\">She is already walking.</i> Follow me. The sea shelf is haunted, but only a little, and only on Tuesdays.",
      "<i class=\"aside\">She tilts her head.</i> You don't look like a lighthouse person. You look like someone running from a storm. Which is it?",
    ],
  };
  let demoSwipe = 0;
  let demoTimers = [];

  function viewHome() {
    const f = B.features;
    const three = [
      { f: byId(f, "scenes"), t: "Play scenes", b: "Chat with your characters. Swipe for another reply, branch the story, stop a reply and keep what was written." },
      { f: byId(f, "workbench"), t: "Make things", b: "Build characters, lorebooks, and presets, and see exactly what your AI will be told." },
      { f: byId(f, "library"), t: "Keep your library", b: "Your library is stored locally and encrypted at rest. Key protection depends on your setup; some fallback configurations store a key file beside it. AI requests send selected content to your chosen provider." },
    ];
    return (
      '<section class="home-hero">' +
      '<div class="home-hero__copy">' +
      '<p class="eyebrow">Free · Open source · Windows, Mac, Linux</p>' +
      '<h1 class="marquee marquee--xl" tabindex="-1">Your stories, kept at <em>home</em>.</h1>' +
      '<p class="serif serif--lg">Roleplay with AI characters, right on your own computer.</p>' +
      '<p class="lede">Bring your character cards, connect an AI provider, and play. Make new characters, worlds, and presets. Your library is stored locally and encrypted at rest; key protection depends on your setup, and some fallback configurations store a key file beside it. AI requests send selected content to your chosen provider, and connected services receive the data needed for their features.</p>' +
      downloadButton("lg") +
      '<p class="alt-link"><a href="#/try">Or try the Studio in your browser, no install</a></p>' +
      "</div>" +
      '<div class="home-hero__art">' + ticketArt() + "</div>" +
      "</section>" +

      actBreak("A scene, in miniature") +

      '<section class="demo-wrap">' +
      '<div class="demo-intro">' +
      '<p class="eyebrow">See it play</p>' +
      '<h2 class="marquee marquee--md">One scene, <em>three</em> ways</h2>' +
      '<p class="lede">This is what a scene feels like. Use the arrows under Wren\'s reply to swipe through other versions, just like in the app.</p>' +
      '<ul class="plus-list"><li>Every swipe is kept.</li><li>Stop a reply and keep what was written.</li><li>Branch any message into a new take.</li></ul>' +
      '<a class="btn btn--panel" href="#/tour/scenes">More about Scenes</a>' +
      "</div>" +
      demoHtml() +
      "</section>" +

      actBreak("Three things you do in it") +

      '<section class="three">' +
      three.map((x) =>
        '<a class="card card--feature" style="--acc: var(--acc-' + x.f.accent + ')" href="#/tour/' + x.f.slug + '">' +
        '<span class="card__num" aria-hidden="true">' + x.f.num + "</span>" +
        '<span class="card__eyebrow">' + x.f.eyebrow + "</span>" +
        '<span class="card__title">' + x.t + "</span>" +
        '<span class="card__body">' + x.b + "</span>" +
        '<span class="card__go">Tour the ' + x.f.title[1] + ' <span aria-hidden="true">&rarr;</span></span>' +
        "</a>"
      ).join("") +
      "</section>" +

      '<section class="also">' +
      '<a class="strip" style="--acc: var(--acc-amber)" href="#/tour/press"><span class="strip__k">IV · The Press</span><span class="strip__t">Export to 11 other apps\' formats, with a plain report of anything that will not fit.</span></a>' +
      '<a class="strip" style="--acc: var(--acc-emerald)" href="#/tour/agent"><span class="strip__k">V · The Agent</span><span class="strip__t">A helper that finds, fixes, and drafts things in your Library, and always asks first.</span></a>' +
      "</section>" +

      '<section class="promise">' +
      '<div class="promise__copy">' +
      '<p class="eyebrow">House rules</p>' +
      '<h2 class="marquee marquee--md">Yours, <em>privately</em></h2>' +
      '<p class="lede">Bunzai is an app on your computer, not a website you log into. There is no Bunzai account to make. When you use an AI provider or connect an external service, selected content or account data is sent to that service.</p>' +
      "</div>" +
      '<div class="knockout" role="list">' +
      '<p role="listitem">+ Free, and the code is open for anyone to read.</p>' +
      '<p role="listitem">+ Your Library is stored on your computer.</p>' +
      '<p role="listitem">+ It is encrypted at rest. Key protection depends on your setup; some fallback configurations keep a key file beside the library.</p>' +
      '<p role="listitem">+ You use your own AI key.</p>' +
      '<p role="listitem">+ Export to 11 other apps whenever you like.</p>' +
      "</div>" +
      "</section>" +

      '<section class="next">' +
      '<p class="eyebrow">Where to next</p>' +
      '<div class="next__grid">' +
      nextLink("#/tour", "Feature tour", "Every part of the app, one page each.") +
      nextLink("#/help", "Guides and help", "Start your first scene, import cards, fix problems.") +
      nextLink("#/download", "Download", "The right build for your computer.") +
      nextLink("#/news", "What's new", "Every release, newest first.") +
      nextLink("#/try", "Try it in your browser", "The Studio, with nothing to install.") +
      "</div>" +
      "</section>"
    );
  }

  const nextLink = (href, t, b) =>
    '<a class="next__link" href="' + href + '"><span class="next__t">' + t + '</span><span class="next__b">' + b + "</span></a>";

  function ticketArt() {
    const rel = latest();
    const no = rel ? "No. " + esc(rel.version) : "No. 0.1";
    return (
      '<div class="ticket-wrap"><figure class="ticket" aria-label="Bunzai admit-one ticket">' +
      '<div class="ticket__main">' +
      '<span class="ticket__top"><span>Bunzai</span><span class="ticket__no">' + no + "</span></span>" +
      '<span class="ticket__admit">Admit<br>One</span>' +
      '<span class="ticket__line">Your seat is on your own computer.</span>' +
      '<span class="ticket__fine">Row B · Seat 12 · No late seating required</span>' +
      "</div>" +
      '<div class="ticket__stub">' +
      '<svg class="ticket__bunny" viewBox="0 0 100 100" aria-hidden="true"><use href="#bunny"/></svg>' +
      '<span class="ticket__keep">Keep this stub</span>' +
      "</div>" +
      "</figure></div>"
    );
  }

  function demoHtml() {
    return (
      '<div class="demo" aria-label="Demo scene with Wren">' +
      '<div class="demo__bar"><span class="demo__who"><span class="portrait portrait--sm" aria-hidden="true">W</span><span><b>' + DEMO.name + "</b><small>" + DEMO.role + "</small></span></span>" +
      '<span class="chip chip--rose">Take 1</span></div>' +
      '<div class="demo__log" id="demo-log">' +
      msg("char", DEMO.greeting, true) +
      msg("user", esc(DEMO.user), true) +
      '<div class="msg msg--char" id="demo-reply"><span class="msg__who">Wren</span><div class="msg__text" id="demo-text"></div>' +
      '<div class="swipe" id="demo-swipe">' +
      '<button type="button" class="swipe__btn" data-swipe="-1" aria-label="Previous reply">&lsaquo;</button>' +
      '<span class="swipe__count" aria-live="polite" id="demo-count">1 / 3</span>' +
      '<button type="button" class="swipe__btn" data-swipe="1" aria-label="Next reply">&rsaquo;</button>' +
      "</div></div>" +
      "</div>" +
      '<div class="demo__input"><span>Your turn. In the app, you would write here.</span><button type="button" class="btn btn--sm btn--panel" id="demo-replay">Replay</button></div>' +
      "</div>"
    );
  }

  const msg = (who, html) =>
    '<div class="msg msg--' + who + '"><span class="msg__who">' + (who === "user" ? "You" : "Wren") + '</span><div class="msg__text">' + html + "</div></div>";

  function playDemo() {
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
    const box = document.getElementById("demo-text");
    const count = document.getElementById("demo-count");
    if (!box) return;
    count.textContent = demoSwipe + 1 + " / " + DEMO.swipes.length;
    const html = DEMO.swipes[demoSwipe];
    if (reduceMotion.matches) { box.innerHTML = html; return; }
    // Stream it in word by word, the way a reply arrives in the app.
    const parts = html.split(/(<[^>]+>|\s+)/).filter((p) => p !== "");
    let i = 0;
    box.innerHTML = '<span class="caret" aria-hidden="true"></span>';
    box.setAttribute("aria-busy", "true");
    const step = () => {
      i = Math.min(parts.length, i + 2);
      box.innerHTML = parts.slice(0, i).join("") + (i < parts.length ? '<span class="caret" aria-hidden="true"></span>' : "");
      if (i < parts.length) demoTimers.push(setTimeout(step, 55));
      else box.removeAttribute("aria-busy");
    };
    demoTimers.push(setTimeout(step, 450));
  }

  function bindDemo() {
    const sw = document.getElementById("demo-swipe");
    if (!sw) return;
    sw.addEventListener("click", (e) => {
      const b = e.target.closest("[data-swipe]");
      if (!b) return;
      const n = DEMO.swipes.length;
      demoSwipe = (demoSwipe + Number(b.dataset.swipe) + n) % n;
      playDemo();
    });
    document.getElementById("demo-replay").addEventListener("click", () => { demoSwipe = 0; playDemo(); });
    playDemo();
  }

  /* ================================================================ */
  /* TOUR                                                             */
  /* ================================================================ */
  function viewTour() {
    return (
      hero("Feature tour", "Every part of the <em>house</em>", "Five rooms, one app. Pick one to look around.", "violet") +
      '<section class="tour-grid">' +
      B.features.map((f) =>
        '<a class="card card--tour" style="--acc: var(--acc-' + f.accent + ')" href="#/tour/' + f.slug + '">' +
        '<span class="card__num" aria-hidden="true">' + f.num + "</span>" +
        '<span class="card__eyebrow">' + f.eyebrow + "</span>" +
        '<span class="card__title">' + f.title.join(" ") + "</span>" +
        '<span class="card__body">' + f.line + "</span>" +
        '<span class="card__list">' + f.items.map((i) => "<span>· " + i.t + "</span>").join("") + "</span>" +
        '<span class="card__go">Look around <span aria-hidden="true">&rarr;</span></span>' +
        "</a>"
      ).join("") +
      "</section>"
    );
  }

  function viewFeature(slug) {
    const f = byId(B.features, slug);
    if (!f) return viewNotFound();
    const idx = B.features.indexOf(f);
    const prev = B.features[(idx - 1 + B.features.length) % B.features.length];
    const next = B.features[(idx + 1) % B.features.length];
    return (
      crumbs([["#/tour", "Feature tour"], [null, f.title.join(" ")]]) +
      '<div class="feature" style="--acc: var(--acc-' + f.accent + ')">' +
      '<header class="hero-panel">' +
      '<span class="hero-panel__num" aria-hidden="true">' + f.num + "</span>" +
      '<p class="eyebrow">' + f.eyebrow + " · Room " + f.num + "</p>" +
      '<h1 class="marquee" tabindex="-1">' + f.title[0] + " <em>" + f.title[1] + "</em></h1>" +
      '<p class="serif">' + f.line + "</p>" +
      "</header>" +
      '<div class="feature__body">' +
      '<div class="feature__copy">' +
      '<p class="lede">' + f.intro + "</p>" +
      '<ol class="items">' +
      f.items.map((i, n) => '<li class="item"><span class="item__n" aria-hidden="true">' + String(n + 1).padStart(2, "0") + '</span><div><h2 class="item__t">' + i.t + '</h2><p class="item__b">' + i.b + "</p></div></li>").join("") +
      "</ol>" +
      "</div>" +
      '<aside class="feature__mock" aria-label="Illustration">' + mockFor(f.mock) + "</aside>" +
      "</div>" +
      '<section class="related"><p class="eyebrow">Related guides</p><div class="related__list">' +
      f.guides.map((g) => { const gd = byId(B.guides, g); return '<a class="chip chip--link" href="#/help/' + gd.slug + '">' + gd.title + "</a>"; }).join("") +
      "</div></section>" +
      '<nav class="pager" aria-label="More rooms">' +
      '<a class="pager__link" href="#/tour/' + prev.slug + '"><small>&larr; Previous room</small>' + prev.title.join(" ") + "</a>" +
      '<a class="pager__link pager__link--next" href="#/tour/' + next.slug + '"><small>Next room &rarr;</small>' + next.title.join(" ") + "</a>" +
      "</nav>" +
      "</div>"
    );
  }

  function mockFor(kind) {
    switch (kind) {
      case "scenes":
        return (
          '<div class="mock">' +
          '<div class="mock__head">Prompting wing <span class="chip chip--rose">This scene</span></div>' +
          '<div class="mock__row"><span>Preset</span><b>Slow Burn</b></div>' +
          toggle("Main prompt", true) + toggle("Example dialogue", true) + toggle("Keep replies short", false) + toggle("Narrate in third person", true) +
          '<div class="mock__samplers"><span>Temp <b>0.9</b></span><span>Top P <b>0.95</b></span><span>Length <b>600</b></span></div>' +
          '<div class="mock__takes"><span class="mock__take is-on">Take 1</span><span class="mock__take">Take 2</span><span class="mock__take">+ New take</span></div>' +
          "</div>"
        );
      case "workbench":
        return (
          '<div class="mock">' +
          '<div class="mock__head">Greeting <span class="chip chip--violet">Live preview</span></div>' +
          '<div class="mock__code">Hello, {{user}}. I\'m {{char}}, and the library closes at midnight.</div>' +
          '<div class="mock__preview">Hello, <b>Sam</b>. I\'m <b>Wren</b>, and the library closes at midnight.</div>' +
          '<div class="mock__split"><span>Wren · Character</span><span>Harbor Town · Lorebook</span></div>' +
          "</div>"
        );
      case "library":
        return (
          '<div class="mock">' +
          '<div class="mock__search">Search your Library <span>lighthouse</span></div>' +
          '<div class="mock__shelf">' +
          ["Wren", "Captain Ines", "The Keeper", "Moth"].map((n, i) => '<div class="pcard pcard--' + i + '"><span class="pcard__init" aria-hidden="true">' + n[0] + "</span><span class=\"pcard__name\">" + n + "</span></div>").join("") +
          "</div>" +
          '<div class="mock__row"><span>Trash</span><b>2 items · kept 3 days</b></div>' +
          "</div>"
        );
      case "press":
        return (
          '<div class="mock">' +
          '<div class="mock__head">Export Wren <span class="chip chip--amber">1 of 11 formats</span></div>' +
          '<div class="knockout knockout--sm">' +
          "<p>+ Name, description, and greeting.</p><p>+ Example dialogue.</p><p>+ Linked lorebook.</p><p class=\"minus\">- Portrait crop: this format has no place for it.</p>" +
          "</div>" +
          '<div class="mock__actions"><span class="btn btn--sm btn--gilt">Export</span><span class="btn btn--sm btn--panel">Pick another format</span></div>' +
          "</div>"
        );
      case "agent":
        return (
          '<div class="mock">' +
          '<div class="mock__head">Agent <span class="chip chip--emerald">Waiting for you</span></div>' +
          '<div class="mock__ask">Fix the typo in Wren\'s greeting.</div>' +
          '<div class="mock__diff"><p class="del">- the libary closes at midnight</p><p class="add">+ the library closes at midnight</p></div>' +
          '<div class="mock__actions"><span class="btn btn--sm btn--emerald">Yes, change it</span><span class="btn btn--sm btn--panel">Not now</span></div>' +
          "</div>"
        );
      default:
        return "";
    }
  }

  const toggle = (label, on) =>
    '<div class="mock__row"><span>' + label + '</span><span class="switch' + (on ? " is-on" : "") + '" aria-label="' + (on ? "On" : "Off") + '"><span></span></span></div>';

  const crumbs = (items) =>
    '<nav class="crumbs" aria-label="Breadcrumb">' +
    items.map(([href, t]) => (href ? '<a href="' + href + '">' + t + "</a>" : '<span aria-current="page">' + t + "</span>")).join('<span class="crumbs__sep" aria-hidden="true">/</span>') +
    "</nav>";

  /* ================================================================ */
  /* HELP: index, search, articles                                    */
  /* ================================================================ */
  const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ");

  // Build the search index once: one entry per guide section, plus feature pages.
  const INDEX = [];
  B.guides.forEach((g) => {
    g.sections.forEach((s) => {
      INDEX.push({ kind: "Guide", title: g.title, sub: s.h, href: "#/help/" + g.slug + "/" + s.id, head: (g.title + " " + s.h + " " + s.id.replace(/-/g, " ")).toLowerCase(), text: plain(s.body.join(" ")) });
    });
  });
  B.features.forEach((f) => {
    INDEX.push({ kind: "Tour", title: f.title.join(" "), sub: f.line, href: "#/tour/" + f.slug, head: (f.title.join(" ") + " " + f.eyebrow).toLowerCase(), text: plain(f.intro + " " + f.items.map((i) => i.t + ". " + i.b).join(" ")) });
  });

  function search(q) {
    const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    if (!terms.length) return [];
    const hits = [];
    INDEX.forEach((e) => {
      const body = e.text.toLowerCase();
      let score = 0, matched = 0;
      for (const t of terms) {
        const inHead = e.head.includes(t);
        const inBody = body.includes(t);
        if (inHead || inBody) matched++;
        score += (inHead ? 6 : 0) + (inBody ? 1 + Math.min(3, body.split(t).length - 2) : 0);
      }
      if (matched) hits.push({ e, score, matched, snip: snippet(e.text, terms) });
    });
    // Pages that match every word come first; if none do, show the closest ones.
    const best = hits.reduce((m, h) => Math.max(m, h.matched), 0);
    return hits
      .filter((h) => h.matched === best || h.matched === terms.length)
      .sort((a, b) => b.matched - a.matched || b.score - a.score)
      .slice(0, 12);
  }

  function snippet(text, terms) {
    const low = text.toLowerCase();
    let at = -1;
    for (const t of terms) { const i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
    const start = Math.max(0, at - 50);
    let s = (start > 0 ? "..." : "") + text.slice(start, start + 170) + (start + 170 < text.length ? "..." : "");
    return highlight(s, terms);
  }

  function highlight(s, terms) {
    let out = esc(s);
    terms.forEach((t) => {
      const re = new RegExp("(" + esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }

  function viewHelp(query) {
    const q = query || "";
    return (
      hero("Guides and help", "How can we <em>help</em>?", "Short guides for every part of Bunzai.", "cyan") +
      '<form class="search" role="search" id="help-search" onsubmit="return false">' +
      '<label class="field-label" for="help-q">Search the guides</label>' +
      '<div class="search__row"><input id="help-q" type="search" autocomplete="off" placeholder="Try: import, lorebook, swipe, Windows warning" value="' + esc(q) + '">' +
      '<kbd class="search__kbd" aria-hidden="true">/</kbd></div>' +
      "</form>" +
      '<div id="help-results" aria-live="polite">' + helpResults(q) + "</div>"
    );
  }

  function helpResults(q) {
    if (q.trim()) {
      const hits = search(q);
      if (!hits.length)
        return '<div class="empty"><p class="serif">The stage is dark for "' + esc(q) + '".</p><p>Try a shorter word, or browse the guides below.</p></div>' + guideCards();
      return (
        '<p class="results-count">' + hits.length + (hits.length === 1 ? " match" : " matches") + "</p>" +
        '<ol class="results">' +
        hits.map((h) =>
          '<li><a class="result" href="' + h.e.href + '"><span class="result__kind">' + h.e.kind + "</span>" +
          '<span class="result__title">' + highlight(h.e.title, q.toLowerCase().split(/\s+/).filter((t) => t.length > 1)) + ' <span class="result__sub">· ' + esc(h.e.sub) + "</span></span>" +
          '<span class="result__snip">' + h.snip + "</span></a></li>"
        ).join("") +
        "</ol>"
      );
    }
    return guideCards();
  }

  function guideCards() {
    return (
      '<section class="guide-grid" aria-label="All guides">' +
      B.guides.map((g, i) =>
        '<a class="card card--guide' + (i === 0 ? " card--first" : "") + '" href="#/help/' + g.slug + '">' +
        '<span class="card__eyebrow">' + g.tag + "</span>" +
        '<span class="card__title">' + g.title + "</span>" +
        '<span class="card__body">' + g.blurb + "</span>" +
        '<span class="card__meta">' + g.sections.length + " short sections</span>" +
        "</a>"
      ).join("") +
      "</section>"
    );
  }

  function bindHelp() {
    const input = document.getElementById("help-q");
    if (!input) return;
    const out = document.getElementById("help-results");
    let t;
    input.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        out.innerHTML = helpResults(input.value);
        const h = "#/help" + (input.value.trim() ? "?q=" + encodeURIComponent(input.value.trim()) : "");
        history.replaceState(null, "", h);
      }, 90);
    });
    if (input.value) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }

  function viewGuide(slug, section) {
    const g = byId(B.guides, slug);
    if (!g) return viewNotFound();
    const idx = B.guides.indexOf(g);
    const next = B.guides[idx + 1];
    const prev = B.guides[idx - 1];
    return (
      crumbs([["#/help", "Guides and help"], [null, g.title]]) +
      '<div class="article-wrap">' +
      '<aside class="toc" aria-label="In this guide"><p class="field-label">In this guide</p><ol>' +
      g.sections.map((s) => '<li><a href="#/help/' + g.slug + "/" + s.id + '"' + (s.id === section ? ' aria-current="true"' : "") + ">" + s.h + "</a></li>").join("") +
      "</ol>" +
      '<a class="toc__back" href="#/help">&larr; All guides</a></aside>' +
      '<article class="article">' +
      '<header class="article__head"><p class="eyebrow">' + g.tag + '</p><h1 class="marquee marquee--md" tabindex="-1">' + g.title + '</h1><p class="serif">' + g.blurb + "</p></header>" +
      g.sections.map((s, i) =>
        '<section class="article__sec" id="sec-' + s.id + '"><h2><span class="article__n" aria-hidden="true">' + (i + 1) + "</span>" + s.h + "</h2>" +
        s.body.map((p) => "<p>" + p + "</p>").join("") + "</section>"
      ).join("") +
      '<nav class="pager" aria-label="More guides">' +
      (prev ? '<a class="pager__link" href="#/help/' + prev.slug + '"><small>&larr; Previous guide</small>' + prev.title + "</a>" : "<span></span>") +
      (next ? '<a class="pager__link pager__link--next" href="#/help/' + next.slug + '"><small>Next guide &rarr;</small>' + next.title + "</a>" : '<a class="pager__link pager__link--next" href="#/help"><small>That is every guide</small>Back to help</a>') +
      "</nav>" +
      "</article></div>"
    );
  }

  /* ================================================================ */
  /* DOWNLOAD                                                         */
  /* ================================================================ */
  function viewDownload() {
    const rel = latest();
    const fam = os.family;
    const known = fam === "windows" || fam === "mac" || fam === "linux";
    const families = ["windows", "mac", "linux"];
    const order = known ? [fam].concat(families.filter((x) => x !== fam)) : families;

    let main = "";
    if (releases.state === "loading" || !rel) {
      main = '<div class="dl-ticket"><p class="serif">The cast is taking their places.</p></div>';
    } else {
      const asset = known ? pickAsset(rel, fam, os.arch) : null;
      main =
        '<div class="dl-ticket">' +
        '<div class="dl-ticket__main">' +
        '<p class="dl-ticket__eyebrow">' + (known ? (os.forced ? "Showing" : "We think you are on") + " " + OS_NAMES[fam] : fam === "mobile" ? "You are on a phone or tablet" : "We could not tell your system") + "</p>" +
        '<h2 class="dl-ticket__title">' + (known ? "Bunzai for " + OS_NAMES[fam] : "Pick your system below") + "</h2>" +
        '<p class="dl-ticket__facts"><span>Version ' + esc(rel.version) + "</span><span>" + fmtDate(rel.date) + "</span>" + (asset ? "<span>" + fmtSize(asset.size) + "</span><span>" + esc(asset.kind) + "</span>" : "") + "</p>" +
        (asset
          ? '<a class="btn btn--rose btn--lg" href="' + esc(asset.url) + '" download>Download for ' + OS_NAMES[fam] + ' <span aria-hidden="true">&darr;</span></a>'
          : known
            ? '<p>This release has no ' + OS_NAMES[fam] + ' build yet. <a href="' + esc(rel.url) + '" rel="noopener">See the release on GitHub</a>.</p>'
            : fam === "mobile"
              ? "<p>Bunzai is a desktop app. Open this page on your Windows, Mac, or Linux computer to download it. Or <a href=\"#/try\">try the Studio in a browser</a>.</p>"
              : "") +
        (fam === "mac" && asset ? '<p class="dl-ticket__hint">' + (os.arch ? "Picked for your " + (os.arch === "x64" ? "Intel" : "Apple silicon") + " Mac." : "Picked for Apple silicon (M1 and newer). Older Intel Mac? Use the Intel download below.") + "</p>" : "") +
        "</div>" +
        '<div class="dl-ticket__stub"><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#bunny"/></svg><span>Admit one</span></div>' +
        "</div>";
    }

    const table = rel
      ? '<section class="dl-all"><h2 class="h-section">All systems</h2>' +
        order.map((f) => {
          const list = rel.assets.filter((a) => a.family === f);
          return (
            '<div class="dl-os' + (f === fam ? " is-yours" : "") + '"><h3>' + OS_NAMES[f] + (f === fam ? ' <span class="chip chip--rose">Yours</span>' : "") + "</h3>" +
            (list.length
              ? "<ul>" + list.map((a) => '<li><a class="dl-file" href="' + esc(a.url) + '" download><span class="dl-file__kind">' + esc(a.kind) + '</span><span class="dl-file__name">' + esc(a.name) + '</span><span class="dl-file__size">' + fmtSize(a.size) + "</span></a></li>").join("") + "</ul>"
              : '<p class="muted">No build for this release yet.</p>') +
            "</div>"
          );
        }).join("") +
        "</section>"
      : "";

    return (
      hero("Download", "Get <em>Bunzai</em>", "Free, open source, and yours to keep.", "rose") +
      '<p class="source-line">' + sourceNote() + (releases.state === "sample" ? ' <a href="' + RELEASES_PAGE + '" rel="noopener">Open the releases page on GitHub</a>' : "") + "</p>" +
      main +
      table +
      '<section class="notes-grid">' +
      '<div class="note" id="windows-warning"><p class="note__k">Windows</p><h3>"Windows protected your PC"</h3>' +
      "<p>This Windows build is unsigned, so Windows may show a reputation warning. The warning does not establish whether a file is safe. Check the release page for a checksum for this exact file and compare it if one is published. If no checksum is available or it does not match, do not open the download; build from source instead.</p></div>" +
      '<div class="note"><p class="note__k">First launch</p><h3>It finds its own seat</h3>' +
      "<p>The first time you open Bunzai, it adds itself to your Start menu, so you can open it like any other app from then on.</p></div>" +
      '<div class="note"><p class="note__k">What you need</p><h3>Your own AI key</h3>' +
      '<p>Bunzai uses a key from the AI service you choose. <a href="#/help/first-scene/key">How to add it</a>.</p></div>' +
      "</section>" +
      '<p class="alt-link center"><a href="#/news">See what changed in each version</a> · <a href="#/try">Try the Studio in your browser first</a></p>'
    );
  }

  /* ================================================================ */
  /* WHAT'S NEW                                                       */
  /* ================================================================ */
  function viewNews() {
    let body;
    if (releases.state === "loading") body = '<p class="serif center">The cast is taking their places.</p>';
    else
      body =
        '<ol class="releases">' +
        releases.list.map((r, i) =>
          '<li class="release' + (i === 0 ? " release--latest" : "") + '">' +
          '<div class="release__side">' +
          (i === 0 ? '<span class="chip chip--live">Now showing</span>' : "") +
          (r.prerelease ? '<span class="chip chip--amber">Preview</span>' : "") +
          '<h2 class="release__v">' + esc(r.version) + "</h2>" +
          '<p class="release__date"><time datetime="' + r.date.toISOString() + '">' + fmtDate(r.date) + "</time><span>" + relTime(r.date) + "</span></p>" +
          "</div>" +
          '<div class="release__notes">' + (r.title ? '<h3 class="release__title">' + esc(r.title) + "</h3>" : "") + md(r.notes) +
          '<p class="release__links"><a href="' + esc(r.url) + '" rel="noopener">View on GitHub</a>' + (i === 0 ? ' · <a href="#/download">Download</a>' : "") + "</p></div>" +
          "</li>"
        ).join("") +
        "</ol>";
    return (
      hero("What's new", "The <em>playbill</em>", "Every release, newest first.", "gold") +
      '<p class="source-line">' + sourceNote() + "</p>" +
      body
    );
  }

  /* ================================================================ */
  /* TRY IT                                                           */
  /* ================================================================ */
  function viewTry() {
    return (
      hero("Try it", "The Studio, in your <em>browser</em>", "Make and edit things right here, with nothing to install.", "violet") +
      '<section class="try">' +
      '<div class="try__panel">' +
      '<p class="lede">The Studio is the making side of Bunzai, running in your browser. Build a character, write a lorebook, or tune a preset and see how it all works.</p>' +
      '<div class="try__cols">' +
      '<div><p class="field-label">In the browser</p><div class="knockout knockout--sm"><p>+ Edit characters, lorebooks, and presets.</p><p>+ Macros with live preview.</p><p>+ Nothing to install.</p></div></div>' +
      '<div><p class="field-label">Needs the app</p><div class="knockout knockout--sm knockout--rose"><p>- Chatting with characters.</p><p>- Keeping your work after the tab closes.</p></div></div>' +
      "</div>" +
      '<div class="alert"><b>Heads up</b> Your work in the browser is kept only while the tab is open. Close the tab and it is gone. To keep something, download the app.</div>' +
      '<div class="try__actions"><a class="btn btn--violet btn--lg" href="' + esc(B.studioUrl) + '" target="_blank" rel="noopener">Open the Studio <span aria-hidden="true">&nearr;</span></a>' +
      '<a class="btn btn--panel btn--lg" href="#/download">Get the app instead</a></div>' +
      "</div>" +
      "</section>"
    );
  }

  function viewNotFound() {
    return hero("Lost backstage", "Wrong <em>door</em>", "This page is not part of the show.", "rose") +
      '<p class="center"><a class="btn btn--rose" href="#/">Back to the front of house</a></p>';
  }

  /* ================================================================ */
  /* Router                                                           */
  /* ================================================================ */
  const TITLES = { "": "Bunzai", tour: "Feature tour", help: "Guides and help", download: "Download", news: "What's new", try: "Try it" };

  function parse() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, qs] = raw.split("?");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    const q = new URLSearchParams(qs || "").get("q") || "";
    return { parts, q };
  }

  let lastKey = "";

  function render(opts) {
    const { parts, q } = parse();
    const [a, b, c] = parts;
    let html, after, title;
    switch (a || "") {
      case "": html = viewHome(); after = bindDemo; title = "Bunzai · AI roleplay on your own computer"; break;
      case "tour": html = b ? viewFeature(b) : viewTour(); title = b && byId(B.features, b) ? byId(B.features, b).title.join(" ") + " · Bunzai" : "Feature tour · Bunzai"; break;
      case "help":
        if (b) { html = viewGuide(b, c); title = (byId(B.guides, b) || { title: "Help" }).title + " · Bunzai"; }
        else { html = viewHelp(q); after = bindHelp; title = "Guides and help · Bunzai"; }
        break;
      case "download": html = viewDownload(); title = "Download · Bunzai"; break;
      case "news": html = viewNews(); title = "What's new · Bunzai"; break;
      case "try": html = viewTry(); title = "Try it · Bunzai"; break;
      default: html = viewNotFound(); title = "Not found · Bunzai";
    }
    app.innerHTML = html;
    document.title = title;
    if (after) after();

    // Nav state
    document.querySelectorAll("[data-nav]").forEach((el) => {
      if (el.dataset.nav === (a || "")) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
    document.getElementById("footer-src").innerHTML = sourceNote(true);
    const v = latest();
    document.querySelectorAll("[data-version]").forEach((el) => { el.textContent = v ? "v" + v.version : ""; });

    // Scroll and focus only on real navigation, not on data refreshes.
    const key = parts.join("/");
    if (opts && opts.nav) {
      const target = a === "help" && b && c ? document.getElementById("sec-" + c) : null;
      if (target) { target.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" }); }
      else if (key !== lastKey) { window.scrollTo(0, 0); }
      if (key !== lastKey && !(a === "help" && !b && q)) {
        const h = app.querySelector("h1");
        if (h) h.focus({ preventScroll: true });
      }
    }
    lastKey = key;
  }

  /* Global events */
  window.addEventListener("hashchange", () => { closeMenu(); render({ nav: true }); });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/input|textarea/i.test((document.activeElement || {}).tagName || "")) {
      const input = document.getElementById("help-q");
      e.preventDefault();
      if (input) input.focus();
      else location.hash = "#/help";
    }
  });

  const menuBtn = document.getElementById("menu-btn");
  const nav = document.getElementById("site-nav");
  function closeMenu() { nav.classList.remove("is-open"); menuBtn.setAttribute("aria-expanded", "false"); }
  menuBtn.addEventListener("click", () => {
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  });

  // Motion preference can change while the page is open.
  if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", () => { if (!location.hash.replace(/^#\/?/, "")) playDemo(); });

  /* When release data lands, update only what depends on it, so a
   * half-typed search or a playing demo is never thrown away. */
  function refreshData() {
    const a = parse().parts[0] || "";
    if (a === "download" || a === "news") { render(); return; }
    const v = latest();
    if (a === "") {
      const cta = app.querySelector(".dl-cta");
      if (cta) cta.outerHTML = downloadButton("lg");
      const no = app.querySelector(".ticket__no");
      if (no && v) no.textContent = "No. " + v.version;
    }
    document.getElementById("footer-src").innerHTML = sourceNote(true);
    document.querySelectorAll("[data-version]").forEach((el) => { el.textContent = v ? "v" + v.version : ""; });
  }

  render({ nav: true });
  loadReleases().then(refreshData);
})();
