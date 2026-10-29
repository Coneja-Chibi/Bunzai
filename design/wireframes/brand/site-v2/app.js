/*
 * The site's behavior: hash routing, stage entrances, the ticker, the live version and releases
 * from GitHub (with the sample data as a fallback), the download picked for the visitor's system,
 * guide search, the self-playing scene with working swipes, the spotlight that follows the pointer,
 * and the chrome turning to paper over the paper section.
 */
(function () {
  var S = window.SITE, P = window.PAGES, esc = window.esc;
  var app = document.getElementById("app");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------- the visitor's system ----------------
  var ua = navigator.userAgent;
  var OS = /Mac/.test(ua) ? "mac" : /Linux|X11/.test(ua) && !/Android/.test(ua) ? "linux" : "windows";
  var OS_NAME = { windows: "Windows", mac: "Mac", linux: "Linux" };

  // ---------------- releases: GitHub first, sample data if it cannot answer ----------------
  var releases = null, source = "sample";
  function fromGitHub(r) {
    var lines = String(r.body || "").split(/\r?\n/).map(function (l) { return l.replace(/^[-*+]\s+/, "").trim(); }).filter(Boolean).slice(0, 6);
    return { tag: r.tag_name, date: (r.published_at || "").slice(0, 10), title: r.name || r.tag_name, notes: lines.length ? lines : ["Release notes are on GitHub."], assets: r.assets || [] };
  }
  var releasesReady = fetch("https://api.github.com/repos/" + S.repo + "/releases?per_page=12", { headers: { Accept: "application/vnd.github+json" } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (list) { if (!Array.isArray(list) || !list.length) throw new Error("empty"); releases = list.map(fromGitHub); source = "github"; })
    .catch(function () { releases = S.fallbackReleases; source = "sample"; })
    .then(function () {
      document.getElementById("verText").textContent = releases[0].tag;
      document.getElementById("verChip").title = source === "github" ? "Latest release, read live from GitHub" : "Latest release (sample data; GitHub did not answer)";
      ticker();
      return releases;
    });
  function ago(date) {
    var d = Math.round((Date.now() - Date.parse(date)) / 864e5);
    if (!isFinite(d)) return "";
    return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 14 ? d + " days ago" : d < 60 ? Math.round(d / 7) + " weeks ago" : Math.round(d / 30) + " months ago";
  }

  // ---------------- the ticker ----------------
  function ticker() {
    var r = releases ? releases[0] : S.fallbackReleases[0];
    var items = ["Now showing <b>" + esc(r.tag) + "</b>", esc(r.title), "Free forever", "Your library stays on your computer", "Bring cards from <b>SillyTavern</b>, <b>RoleCall</b>, <b>Chub</b>", "Swipe · branch · keep every version", "All the world’s a stage"];
    var half = items.map(function (t) { return "<span>✦ " + t + "</span>"; }).join("");
    document.getElementById("ticker").innerHTML = half + half;
  }
  ticker();

  // ---------------- routing ----------------
  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    var top = parts[0] || "home";
    document.body.classList.remove("menu", "on-paper");
    document.querySelectorAll("[data-nav]").forEach(function (a) { a.classList.toggle("on", a.dataset.nav === top); });
    var html = top === "tour" && parts[1] ? P.feature(parts[1]) : top === "guides" && parts[1] ? P.article(parts[1]) : (P[top] || P.home)();
    app.innerHTML = '<div class="page">' + html + "</div>";
    window.scrollTo(0, 0);
    reveals();
    blooms();
    if (top === "home") { playScene(); paperWatch(); osCopy(); serial(); }
    if (top === "guides" && !parts[1]) search();
    if (top === "guides" && parts[1]) tocWatch();
    if (top === "download") download();
    if (top === "whats-new") whatsNew();
  }
  window.addEventListener("hashchange", route);

  // ---------------- stage entrances ----------------
  function reveals() {
    var els = app.querySelectorAll(".reveal");
    if (reduce || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var sibs = Array.prototype.indexOf.call(en.target.parentNode.children, en.target);
        en.target.style.transitionDelay = Math.min(sibs, 4) * 150 + "ms";
        en.target.classList.add("in"); io.unobserve(en.target);
      });
    }, { threshold: 0.12 });
    els.forEach(function (e) { io.observe(e); });
  }

  // ---------------- the spotlight bloom follows the pointer inside hero panels ----------------
  function blooms() {
    app.querySelectorAll(".hero-panel").forEach(function (p) {
      var b = p.querySelector(".bloom"); if (!b || reduce) return;
      p.addEventListener("pointermove", function (e) {
        var r = p.getBoundingClientRect();
        b.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 60 + 20 + "%");
        b.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 60 + 20 + "%");
      });
    });
  }

  // ---------------- the paper section turns the chrome to paper ----------------
  function paperWatch() {
    var paper = document.getElementById("c-paper");
    if (!paper || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (en) { document.body.classList.toggle("on-paper", en[0].isIntersecting && en[0].intersectionRatio > 0.35); }, { threshold: [0, 0.35, 0.6] }).observe(paper);
  }

  // ---------------- copy that knows the visitor's system ----------------
  function osCopy() {
    var others = ["windows", "mac", "linux"].filter(function (o) { return o !== OS; }).map(function (o) { return OS_NAME[o]; });
    var cta = app.querySelector("[data-os-cta]"); if (cta) cta.textContent = "Get Bunzai for " + OS_NAME[OS];
    var note = app.querySelector("[data-os-note]"); if (note) note.textContent = "Also for " + others.join(" and ") + " · no account needed";
  }
  function serial() {
    var s = app.querySelector("[data-serial]");
    if (s) s.textContent = "No. " + String(Math.floor(Math.random() * 900000) + 100000);
  }

  // ---------------- the self-playing scene, with working swipes ----------------
  var sceneTimers = [];
  function playScene() {
    sceneTimers.forEach(clearTimeout); sceneTimers = [];
    var body = document.getElementById("chatBody"); if (!body) return;
    body.textContent = "";
    var box = document.getElementById("chat");
    var started = false;
    function begin() { if (started) return; started = true; line(0); }
    if (reduce || !("IntersectionObserver" in window)) begin();
    else new IntersectionObserver(function (en, io) { if (en[0].isIntersecting) { io.disconnect(); begin(); } }, { threshold: 0.4 }).observe(box);

    function line(i) {
      if (i >= S.demo.length) return;
      var d = S.demo[i];
      var row = document.createElement("div"); row.className = "row" + (d.me ? " me" : ""); row.style.setProperty("--c1", d.c1); row.style.setProperty("--c2", d.c2);
      var face = document.createElement("div"); face.className = "face"; face.textContent = d.me ? "Y" : d.who[0];
      var bub = document.createElement("div"); bub.className = "bubble";
      var who = document.createElement("span"); who.className = "who"; who.textContent = d.who;
      var text = document.createElement("span"); var caret = document.createElement("i"); caret.className = "caret";
      bub.appendChild(who); bub.appendChild(text); bub.appendChild(caret);
      row.appendChild(face); row.appendChild(bub); body.appendChild(row);
      type(text, d.versions[0], function () {
        caret.remove();
        if (d.versions.length > 1) swipes(bub, text, d.versions);
        sceneTimers.push(setTimeout(function () { line(i + 1); }, 650));
      });
    }
    function type(el, str, done) {
      if (reduce) { el.textContent = str; done(); return; }
      var k = 0;
      (function step() { el.textContent = str.slice(0, ++k); if (k < str.length) sceneTimers.push(setTimeout(step, 18)); else done(); })();
    }
    function swipes(bub, text, versions) {
      var at = 0;
      var bar = document.createElement("div"); bar.className = "swipebar";
      var prev = document.createElement("button"); prev.type = "button"; prev.textContent = "‹"; prev.setAttribute("aria-label", "Previous version");
      var n = document.createElement("span"); n.className = "n";
      var next = document.createElement("button"); next.type = "button"; next.textContent = "›"; next.setAttribute("aria-label", "Another reply");
      function show() { n.textContent = at + 1 + " / " + versions.length; text.textContent = versions[at]; }
      prev.onclick = function () { at = (at + versions.length - 1) % versions.length; show(); };
      next.onclick = function () { at = (at + 1) % versions.length; show(); hint.remove(); };
      bar.appendChild(prev); bar.appendChild(n); bar.appendChild(next); bub.appendChild(bar); show();
      var hint = document.createElement("span"); hint.className = "hint-pop"; hint.textContent = "Swipe me"; bub.appendChild(hint);
    }
  }

  // ---------------- guide search ----------------
  function search() {
    var q = document.getElementById("q"), out = document.getElementById("results"), cats = document.getElementById("gcats");
    var index = Object.keys(S.guides).map(function (id) {
      var g = S.guides[id];
      return { id: id, title: g.title, about: g.about, text: (g.title + " " + g.about + " " + g.sections.map(function (s) { return s.h + " " + s.p + " " + (s.steps || []).join(" ") + " " + (s.tip || ""); }).join(" ")).toLowerCase() };
    });
    function mark(t, term) {
      var at = t.toLowerCase().indexOf(term);
      return at < 0 ? esc(t) : esc(t.slice(0, at)) + "<mark>" + esc(t.slice(at, at + term.length)) + "</mark>" + esc(t.slice(at + term.length));
    }
    q.addEventListener("input", function () {
      var term = q.value.trim().toLowerCase();
      cats.style.display = term ? "none" : "";
      if (!term) { out.innerHTML = ""; return; }
      var words = term.split(/\s+/);
      var hits = index.filter(function (g) { return words.every(function (w) { return g.text.indexOf(w) >= 0; }); });
      out.innerHTML = hits.length
        ? hits.map(function (g) { return '<a class="card res" href="#/guides/' + esc(g.id) + '"><b>' + mark(g.title, words[0]) + "</b><small>" + mark(g.about, words[0]) + "</small></a>"; }).join("")
        : '<div class="panel empty-stage">The stage is dark for “' + esc(q.value) + "”. Try another word.</div>";
    });
    document.addEventListener("keydown", function slash(e) {
      if (!document.body.contains(q)) { document.removeEventListener("keydown", slash); return; }
      if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); }
    });
  }

  // ---------------- the article's table of contents follows the reading ----------------
  function tocWatch() {
    var links = app.querySelectorAll(".toc a");
    links.forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); var t = document.getElementById(a.dataset.sec); if (t) t.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); }); });
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) links.forEach(function (a) { a.classList.toggle("on", a.dataset.sec === en.target.id); }); });
    }, { rootMargin: "-20% 0px -70% 0px" });
    app.querySelectorAll(".prose h2").forEach(function (h) { io.observe(h); });
  }

  // ---------------- download ----------------
  var PLATS = {
    windows: { name: "Windows", ic: "W", match: /\.exe$|win/i, size: "about 140 MB", file: "Bunzai.exe" },
    mac: { name: "Mac", ic: "M", match: /darwin|mac/i, size: "about 90 MB", file: "Apple chip or Intel" },
    linux: { name: "Linux", ic: "L", match: /linux/i, size: "about 90 MB", file: "x64 or ARM" },
  };
  function download() {
    releasesReady.then(function (list) {
      if (!document.getElementById("plats")) return;
      var r = list[0];
      function asset(k) { return (r.assets || []).find(function (a) { return PLATS[k].match.test(a.name); }); }
      function size(a) { return a ? Math.round(a.size / 1048576) + " MB" : PLATS[OS].size; }
      var mine = asset(OS);
      app.querySelector("[data-dl-adm]").textContent = "ADMIT ONE · " + OS_NAME[OS].toUpperCase();
      app.querySelector("[data-dl-title]").textContent = "BUNZAI";
      app.querySelector("[data-dl-ver]").textContent = "Version " + r.tag.replace(/^v/, "") + (r.date ? ", released " + ago(r.date) : "") + ".";
      app.querySelector("[data-dl-size]").textContent = "One file, " + (mine ? size(mine) : PLATS[OS].size) + ", for " + OS_NAME[OS] + ".";
      var btn = app.querySelector("[data-dl-btn]");
      btn.href = mine ? mine.browser_download_url : "https://github.com/" + S.repo + "/releases/latest";
      btn.textContent = "Download for " + OS_NAME[OS];
      document.getElementById("plats").innerHTML = ["windows", "mac", "linux"].map(function (k) {
        var a = asset(k), p = PLATS[k];
        var href = a ? a.browser_download_url : "https://github.com/" + S.repo + "/releases/latest";
        return '<div class="card plat reveal in"><span class="ic">' + esc(p.ic) + '</span><div class="grow"><b>' + esc(p.name) + (k === OS ? ' <span class="yours">your computer</span>' : "") + "</b><small>" + esc(a ? a.name : p.file) + " · " + esc(a ? size(a) : p.size) + '</small></div><a class="btn" style="padding:10px 16px" href="' + esc(href) + '">Get</a></div>';
      }).join("");
      app.querySelector("[data-dl-source]").textContent = source === "github" ? "Read live from GitHub releases." : "GitHub did not answer, so this shows sample data. The buttons still lead to the real releases page.";
    });
  }

  // ---------------- what's new ----------------
  function whatsNew() {
    var hues = ["var(--brand)", "var(--cat-pink)", "var(--accent)", "var(--gold)", "var(--cat-cyan)"];
    releasesReady.then(function (list) {
      var root = document.getElementById("releases"); if (!root) return;
      root.innerHTML = list.map(function (r, i) {
        var c = hues[i % hues.length];
        return '<div class="rel reveal in" style="--c:' + c + '"><div class="when"><b>' + esc(r.tag) + "</b><small>" + esc(r.date) + (r.date ? " · " + esc(ago(r.date)) : "") + "</small></div>" +
          '<div class="card" style="box-shadow:6px 6px 0 ' + c + '">' + (i === 0 ? '<span class="newest">NEWEST</span>' : "") + '<span class="eyebrow" style="color:' + c + '">Release</span><h3>' + esc(r.title) + "</h3><ul>" + r.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></div></div>";
      }).join("") + '<p class="source">' + (source === "github" ? "Read live from GitHub releases." : "GitHub did not answer, so this shows sample data.") + "</p>";
    });
  }

  // ---------------- the phone menu ----------------
  document.getElementById("burger").addEventListener("click", function () {
    var open = document.body.classList.toggle("menu");
    this.setAttribute("aria-expanded", String(open));
  });

  route();
})();
