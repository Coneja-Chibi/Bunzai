/* Bunzai site prototype. Hash routing, live releases with sample fallback, OS detection, help search. */
(function () {
  "use strict";

  var REPO = "Coneja-Chibi/Bunzai";
  var API = "https://api.github.com/repos/" + REPO + "/releases";
  var RELEASES_PAGE = "https://github.com/" + REPO + "/releases";
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) {
    return typeof u === "string" && /^https:\/\/github\.com\//.test(u) ? u : RELEASES_PAGE;
  }
  function icon(id, cls) {
    return '<svg class="' + (cls || "") + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  function fmtShort(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  function fmtSize(bytes) {
    if (!bytes || bytes < 1) return "";
    return (bytes / 1048576).toFixed(1) + " MB";
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- releases: one source for home, download, what's new ---------- */
  function sampleAssets(v) {
    var base = "https://github.com/" + REPO + "/releases/download/v" + v + "/";
    return [
      { name: "Bunzai_" + v + "_x64-setup.exe", size: 82208768, url: base + "Bunzai_" + v + "_x64-setup.exe" },
      { name: "Bunzai_" + v + "_universal.dmg", size: 96574259, url: base + "Bunzai_" + v + "_universal.dmg" },
      { name: "Bunzai_" + v + "_amd64.AppImage", size: 101502566, url: base + "Bunzai_" + v + "_amd64.AppImage" },
      { name: "Bunzai_" + v + "_amd64.deb", size: 74763059, url: base + "Bunzai_" + v + "_amd64.deb" }
    ];
  }
  var SAMPLE = [
    { tag: "v0.1.42", title: "The Prompting wing", date: "2026-09-25T00:00:00Z", url: RELEASES_PAGE,
      notes: ["Pick a preset per scene.", "Switch prompts and samplers on and off per scene.", "Imported presets keep their example dialogue."], assets: sampleAssets("0.1.42") },
    { tag: "v0.1.41", title: "Scenes can talk", date: "2026-09-18T00:00:00Z", url: RELEASES_PAGE,
      notes: ["Chat with any character.", "Swipes and retries.", "Replies cut off by a crash come back."], assets: sampleAssets("0.1.41") },
    { tag: "v0.1.40", title: "Takes and cuts", date: "2026-09-11T00:00:00Z", url: RELEASES_PAGE,
      notes: ["Branch scenes into takes.", "Cut messages can be restored for 3 days.", "Portrait cards in the Library."], assets: sampleAssets("0.1.40") }
  ];

  var releases = { list: SAMPLE, live: false };

  function parseRelease(r) {
    if (!r || typeof r !== "object" || r.draft) return null;
    var tag = typeof r.tag_name === "string" ? r.tag_name : "";
    if (!tag) return null;
    var body = typeof r.body === "string" ? r.body : "";
    var notes = body.split(/\r?\n/).map(function (l) { return l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "").replace(/^#+\s*/, "").trim(); })
      .filter(function (l) { return l.length > 0; }).slice(0, 12);
    var assets = Array.isArray(r.assets) ? r.assets.map(function (a) {
      return { name: String(a && a.name || ""), size: Number(a && a.size) || 0, url: a && a.browser_download_url };
    }).filter(function (a) { return a.name; }) : [];
    return {
      tag: tag,
      title: typeof r.name === "string" && r.name.trim() ? r.name.trim() : tag,
      date: r.published_at || r.created_at || "",
      url: r.html_url,
      notes: notes,
      assets: assets
    };
  }

  function loadReleases() {
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem("bunzai-releases") || "null"); } catch (e) { cached = null; }
    if (cached && Array.isArray(cached) && cached.length) {
      releases = { list: cached, live: true };
      fillReleaseSlots();
      return;
    }
    if (!window.fetch) return;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 5000);
    fetch(API, { headers: { Accept: "application/vnd.github+json" }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) { if (!res.ok) throw new Error("status " + res.status); return res.json(); })
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error("not a list");
        var list = data.map(parseRelease).filter(Boolean).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
        if (!list.length) throw new Error("no releases");
        releases = { list: list, live: true };
        try { sessionStorage.setItem("bunzai-releases", JSON.stringify(list)); } catch (e) { /* storage off: fine */ }
        fillReleaseSlots();
      })
      .catch(function () { /* keep sample data; the source note already says so */ })
      .then(function () { clearTimeout(timer); });
  }

  /* ---------- OS detection ---------- */
  var OS = {
    windows: { name: "Windows", icon: "i-windows", match: /\.(exe|msi)$/i, note: "Windows 10 or 11" },
    mac: { name: "Mac", icon: "i-mac", match: /\.dmg$/i, note: "macOS 11 or newer, Apple silicon or Intel" },
    linux: { name: "Linux", icon: "i-linux", match: /\.appimage$/i, note: "AppImage, runs on most systems" },
    linuxdeb: { name: "Linux (.deb)", icon: "i-linux", match: /\.deb$/i, note: "For Ubuntu, Debian, Mint" }
  };
  function detectOS() {
    var q = (location.hash.split("?")[1] || "").match(/(?:^|&)os=(\w+)/);
    if (q) return q[1];
    var ua = navigator.userAgent || "";
    var uad = navigator.userAgentData;
    var plat = ((uad && uad.platform) || navigator.platform || "").toLowerCase();
    if ((uad && uad.mobile) || /android|iphone|ipad|ipod/i.test(ua)) return "mobile";
    if (/mac/.test(plat) && navigator.maxTouchPoints > 1) return "mobile";
    if (/win/.test(plat) || /windows/i.test(ua)) return "windows";
    if (/mac/.test(plat) || /mac os x/i.test(ua)) return "mac";
    if (/linux|x11|cros/.test(plat) || /linux|x11/i.test(ua)) return "linux";
    return "unknown";
  }
  function assetFor(rel, key) {
    var o = OS[key];
    if (!rel || !o) return null;
    for (var i = 0; i < rel.assets.length; i++) if (o.match.test(rel.assets[i].name)) return rel.assets[i];
    return null;
  }

  /* One renderer for the admit-one download ticket (home + download page). */
  function ticketHTML() {
    var os = detectOS();
    var rel = releases.list[0];
    var v = rel ? esc(rel.tag) : "";
    var d = rel ? esc(fmtShort(rel.date)) : "";
    if (os === "mobile") {
      return '<div class="ticket"><a class="ticket-main" href="#/try"><span class="t-kicker">On a phone or tablet</span>' +
        '<span class="t-title">' + icon("i-browser") + 'Try the Studio instead</span></a>' +
        '<div class="ticket-stub"><span>Bunzai runs on computers</span><b>' + v + '</b></div></div>' +
        '<p class="ticket-alt">Send yourself the link for later, or <a href="#/download">see all downloads</a>.</p>';
    }
    var key = OS[os] ? os : "windows";
    var asset = assetFor(rel, key);
    var href = asset ? esc(safeUrl(asset.url)) : esc(safeUrl(rel && rel.url));
    var size = asset ? esc(fmtSize(asset.size)) : "";
    var kicker = OS[os] ? "Free download" : "Free download, pick your system below";
    return '<div class="ticket"><a class="ticket-main" href="' + href + '">' +
      '<span class="t-kicker">' + esc(kicker) + '</span>' +
      '<span class="t-title">' + icon(OS[key].icon) + 'Get Bunzai for ' + esc(OS[key].name) + '</span></a>' +
      '<div class="ticket-stub" aria-label="Release details"><b>' + v + '</b><span>' + d + '</span><span>' + size + '</span></div></div>' +
      '<p class="ticket-alt">Also for ' + ["windows", "mac", "linux"].filter(function (k) { return k !== key; })
        .map(function (k) { return '<a href="#/download">' + OS[k].name + '</a>'; }).join(" and ") +
      '. Or <a href="#/try">try it in your browser</a>.</p>';
  }

  function sourceNoteHTML() {
    return releases.live
      ? '<span class="pill"><span class="dot"></span>Up to date from GitHub</span>'
      : '<span class="pill sample"><span class="dot"></span>Showing sample releases</span>';
  }

  function releaseListHTML() {
    return releases.list.map(function (r, i) {
      var notes = r.notes.length ? "<ul>" + r.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>" : "<p>Small fixes and polish.</p>";
      return '<li class="release"><div class="stub"><b>' + esc(r.tag) + '</b><span>' + esc(fmtDate(r.date)) + '</span>' +
        (i === 0 ? '<span class="latest">Latest</span>' : "") + '</div>' +
        '<div class="body"><h2>' + esc(r.title) + '</h2>' + notes +
        '<a class="small" href="' + esc(safeUrl(r.url)) + '">See it on GitHub</a></div></li>';
    }).join("");
  }

  function downloadDetailHTML() {
    var rel = releases.list[0];
    var os = detectOS();
    var rows = ["windows", "mac", "linux", "linuxdeb"].map(function (k) {
      var a = assetFor(rel, k);
      var mine = k === os;
      return '<li>' + icon(OS[k].icon, "os") + '<div><b>' + esc(OS[k].name) + (mine ? ' <span class="muted small">(this computer)</span>' : "") + '</b>' +
        '<div class="small muted">' + esc(OS[k].note) + '</div>' +
        (a ? '<div class="f">' + esc(a.name) + ' &middot; <span style="white-space:nowrap">' + esc(fmtSize(a.size)) + '</span></div>' : '<div class="f">Not in this release yet</div>') + '</div>' +
        (a ? '<a class="btn btn-quiet" href="' + esc(safeUrl(a.url)) + '">' + icon("i-down") + 'Get</a>' : "") + '</li>';
    }).join("");
    return rows;
  }

  function factsHTML() {
    var rel = releases.list[0];
    var os = detectOS();
    var a = assetFor(rel, OS[os] ? os : "windows");
    return '<div><dt>Version</dt><dd>' + esc(rel ? rel.tag : "") + '</dd></div><div><dt>Released</dt><dd>' + esc(rel ? fmtDate(rel.date) : "") + '</dd></div><div><dt>Size</dt><dd>' + esc(a ? fmtSize(a.size) : "Varies") + '</dd></div>';
  }

  function fillReleaseSlots() {
    var rel = releases.list[0];
    $all("[data-slot=version]").forEach(function (el) { el.textContent = rel ? rel.tag : ""; });
    $all("[data-slot=ticket]").forEach(function (el) { el.innerHTML = ticketHTML(); });
    $all("[data-slot=source]").forEach(function (el) { el.innerHTML = sourceNoteHTML(); });
    $all("[data-slot=releases]").forEach(function (el) { el.innerHTML = releaseListHTML(); });
    $all("[data-slot=others]").forEach(function (el) { el.innerHTML = downloadDetailHTML(); });
    $all("[data-slot=facts]").forEach(function (el) { el.innerHTML = factsHTML(); });
  }

  /* ---------- content ---------- */
  var FEATURES = [
    { slug: "scenes", name: "Scenes", verb: "Play", icon: "i-chat",
      blurb: "Chat with your characters. Swipe for another reply, branch the story, and keep what you like.",
      intro: "A scene is one story with one or more characters. You write, they answer, and you stay in charge of where it goes.",
      points: [
        ["Chat that feels like a story", "Your messages and theirs, laid out like a script you can read back."],
        ["Swipe for another reply", "Not feeling it? Swipe to see a different answer. Your earlier ones stay, so you can swipe back."],
        ["Branch into takes", "Try the scene a different way without losing the first one. Each take is its own path."],
        ["Stop a reply and keep it", "Cut a reply off mid-sentence and keep what was written so far."],
        ["Presets per scene", "Each scene can use its own preset. Switch single prompts on and off without touching the others."]
      ] },
    { slug: "workbench", name: "Workbench", verb: "Make", icon: "i-pen",
      blurb: "Editors for characters, lorebooks and presets, with a live preview of what the AI will read.",
      intro: "The Workbench is where you make things. Characters, lorebooks and presets each get an editor built for them.",
      points: [
        ["Editors for every piece", "Characters, lorebooks and presets, with the fields you actually use up front."],
        ["See the prompt as it will be sent", "Open a preset and read the full prompt in order, exactly as the AI will get it."],
        ["Macros with live preview", "Type a macro like {{char}} and watch it fill in as you write."],
        ["Two pieces side by side", "Open a character next to its lorebook, or two presets to compare."]
      ] },
    { slug: "library", name: "Library", verb: "Keep", icon: "i-shelf",
      blurb: "Bring cards from other apps. Everything shows as portrait cards, stays searchable, and stays encrypted.",
      intro: "Your Library holds every character, lorebook and preset you own. It lives on your computer, locked up.",
      points: [
        ["Imports from many apps", "Drop in cards from SillyTavern, RoleCall, Chub and more. Bunzai sorts out the format."],
        ["Portrait cards", "Characters show as tall portrait cards, so your shelf looks like a cast list."],
        ["Search everything", "Find a character, a lorebook entry, or that one preset by name or by what is inside."],
        ["Encrypted on your machine", "Your library is stored encrypted. Nothing is uploaded anywhere."],
        ["A Trash that waits 3 days", "Deleted something by accident? It stays in the Trash for 3 days before it is gone."]
      ] },
    { slug: "press", name: "Press", verb: "Share", icon: "i-down",
      blurb: "Export to 11 other apps' formats, with a plain report of anything a format cannot hold.",
      intro: "The Press turns your work into files other apps can open. Share a card, move to another app, or keep a copy.",
      points: [
        ["11 formats", "Export characters, lorebooks and presets for 11 other apps."],
        ["A report, not a surprise", "Some formats cannot hold everything. The Press tells you exactly what will be left out before you save."],
        ["Keep a copy anywhere", "Exports are regular files. Put them wherever you like."]
      ] },
    { slug: "agent", name: "Agent", verb: "Help", icon: "i-search",
      blurb: "A helper that finds, fixes or drafts things in your library, and always asks before changing anything.",
      intro: "The Agent is a helper that knows your Library. Ask it to find, tidy or draft something, and it shows you the change first.",
      points: [
        ["Find things", "\"Which of my characters mention the lighthouse?\" It searches for you."],
        ["Fix things", "Spot a broken lorebook key or a typo across ten cards, and get a fix to review."],
        ["Draft things", "Ask for a first draft of a character or a lorebook entry to start from."],
        ["Asks before changing", "Nothing in your Library changes until you say yes."]
      ] }
  ];

  var HELP = [
    { slug: "first-scene", title: "Your first scene", summary: "From a fresh install to your first reply in a few minutes.", sections: [
      { h: "Before you start", p: ["You need Bunzai installed and a key from an AI provider. The key is what lets a character answer you. Bunzai keeps it on your computer, encrypted."] },
      { h: "Add your AI key", p: ["Open Settings, then Connections. Pick your provider, paste your key, and press Check. A green mark means it works."] },
      { h: "Pick a character", p: ["Go to your Library and choose a character. No characters yet? Import a card (see Importing cards) or make one in the Workbench."] },
      { h: "Start the scene", p: ["Press Start scene on the character card. Say hello. The character answers in a moment.", "If you do not like the reply, swipe for another one."] }
    ] },
    { slug: "importing-cards", title: "Importing cards", summary: "Bring characters in from SillyTavern, RoleCall, Chub and more.", sections: [
      { h: "What you can import", p: ["Character cards as PNG or JSON, lorebooks, and presets from SillyTavern, RoleCall, Chub and other apps."] },
      { h: "How to import", p: ["Drag the file onto the Library, or press Import and pick one or many files. Bunzai reads the format for you."] },
      { h: "If something looks off", p: ["Open the card in the Workbench. Anything Bunzai could not place is kept in the card's Extras, so nothing you brought in is thrown away."] }
    ] },
    { slug: "presets", title: "Presets and the Prompting wing", summary: "What presets do, and how to switch prompts per scene.", sections: [
      { h: "What a preset is", p: ["A preset is the set of instructions and settings sent to the AI with your chat. It shapes the voice, length and style of replies."] },
      { h: "The Prompting wing", p: ["In a scene, open the Prompting wing on the side. You will see every prompt in the preset as a switch. Turn one off and the next reply will not include it."] },
      { h: "One preset per scene", p: ["Each scene can use its own preset. Changing it in one scene does not touch your other scenes."] },
      { h: "See what gets sent", p: ["In the Workbench, open a preset and press Preview. You will see the full prompt in order, exactly as the AI reads it."] }
    ] },
    { slug: "swipes-takes", title: "Swipes, retries, and takes", summary: "Three ways to try again, and when to use each.", sections: [
      { h: "Swipes", p: ["Swipe left or right on a reply to see another version. Every version stays, so you can swipe back to one you liked."] },
      { h: "Retries", p: ["Retry asks for a fresh reply in place of the last one. Use it when a reply went wrong, like a cut-off or an error."] },
      { h: "Takes", p: ["A take is a branch of the whole story. Start a new take from any message to try a different direction. Your first take stays exactly as it was."] },
      { h: "Stopping a reply", p: ["Press Stop while a reply is being written. You keep what was written so far and can edit or continue it."] }
    ] },
    { slug: "lorebooks", title: "Lorebooks", summary: "Give your world a memory the AI can look things up in.", sections: [
      { h: "What a lorebook does", p: ["A lorebook is a set of notes about your world. When a keyword comes up in the chat, the matching note is added for the AI to read."] },
      { h: "Making entries", p: ["In the Workbench, open a lorebook and add an entry. Give it a few keywords and write the note. Keep notes short and clear."] },
      { h: "Linking to characters", p: ["Attach a lorebook to a character or to a single scene. It only shows up where you attach it."] }
    ] },
    { slug: "backups", title: "Backups and moving computers", summary: "Keep a copy of everything, and move it to a new machine.", sections: [
      { h: "Making a backup", p: ["Open Settings, then Backups, and press Make a backup. You get one file that holds your whole Library, encrypted with your recovery phrase."] },
      { h: "Your recovery phrase", p: ["When you first set up Bunzai you printed or wrote down a recovery phrase. You need it to open a backup. Keep it somewhere safe and offline."] },
      { h: "Moving to a new computer", p: ["Install Bunzai on the new computer, choose Restore from backup, pick the file, and enter your recovery phrase."] }
    ] },
    { slug: "something-wrong", title: "Something went wrong", summary: "Install warnings, errors, and what to try first.", sections: [
      { h: "Windows says it does not recognize the app", p: ["This Windows build is unsigned, so Windows may show a reputation warning. The warning does not establish whether the file is safe. Check the release page for a checksum for this exact file and compare it if published. If no checksum is published or it does not match, do not open the download; use the repository's build-from-source instructions.", "After a verified first launch, Bunzai adds itself to the Start menu."] },
      { h: "Mac says it cannot be opened", p: ["Right-click Bunzai in Applications, choose Open, then press Open again."] },
      { h: "A reply stopped halfway", p: ["If Bunzai or your computer closed during a reply, the part that was written comes back when you reopen the scene. Press Retry for a fresh one."] },
      { h: "My key does not work", p: ["Open Settings, then Connections, and press Check. If it fails, the message says why. Most often the key was copied with a missing letter, or the account needs credit."] },
      { h: "I deleted something", p: ["Look in the Trash. Things stay there for 3 days before they are gone for good."] }
    ] }
  ];

  var DEMO = {
    user: "Hi. I think I left something on this train. A little brass key?",
    replies: [
      "<i>Juniper runs a finger down her ledger without looking up.</i> \"Brass key, brass key. We have eleven. Does yours hum when you hold it near a window?\"",
      "<i>She sets down her tea.</i> \"Nobody leaves a key by accident on this line.\" <i>A small envelope slides across the counter.</i> \"It came with a note. Addressed to you.\"",
      "\"Ah, <i>that</i> key!\" <i>Juniper brightens and pulls a shoebox from under the counter.</i> \"I grew fond of it. Tell me what it opens and it is yours.\""
    ]
  };

  /* ---------- views ---------- */
  function homeView() {
    return '' +
      '<section class="hero"><div class="wrap hero-grid"><div>' +
        '<span class="eyebrow">Free desktop app for Windows, Mac and Linux</span>' +
        '<h1>Your characters, your stories, <em>your computer.</em></h1>' +
        '<p class="lede">Bunzai is a cozy home for AI roleplay. Bring your character cards, chat with them using your own AI key, and make new ones. Everything stays private on your machine.</p>' +
        '<div data-slot="ticket"></div>' +
        '<div class="hero-meta"><a class="pill" href="#/whats-new"><span class="dot"></span>Latest: <span data-slot="version"></span></a><span data-slot="source"></span></div>' +
      '</div>' +
      '<div class="demo" role="region" aria-label="Chat demo">' +
        '<div class="demo-head"><div class="avatar" aria-hidden="true">J</div><div class="who"><b>Juniper Hale</b><span>Lost and found, the Night Train</span></div><span class="tag">Demo</span></div>' +
        '<div class="demo-body"><div class="msg user">' + esc(DEMO.user) + '</div><div class="msg char" id="demo-reply" aria-live="polite"></div></div>' +
        '<div class="swipes"><button type="button" id="demo-prev" aria-label="Previous reply">' + icon("i-left") + '</button>' +
          '<span class="count" id="demo-count">1 of 3</span>' +
          '<button type="button" id="demo-next" aria-label="Next reply">' + icon("i-right") + '</button>' +
          '<span class="hint">Swipe for another reply</span></div>' +
        '<div class="demo-foot">These replies are written ahead of time. In the app, your AI writes new ones.</div>' +
      '</div></div></section>' +

      '<section class="band alt"><div class="wrap"><div class="section-head"><span class="eyebrow">What you do in Bunzai</span><h2>Three things, all in one place.</h2></div>' +
        '<div class="three">' +
          threeCard("01", "i-chat", "Play scenes", "Chat with any character. Swipe for another reply, branch into takes, stop a reply and keep it.", "#/features/scenes") +
          threeCard("02", "i-pen", "Make things", "Write characters, worlds and presets, and see exactly what the AI will read.", "#/features/workbench") +
          threeCard("03", "i-shelf", "Keep your library", "Import cards from other apps, find anything, and export to 11 formats.", "#/features/library") +
        '</div></div></section>' +

      '<section class="band"><div class="wrap split"><div>' +
        '<span class="eyebrow">Private by default</span><h2>It all stays with you.</h2>' +
        '<p class="lede">No account, no cloud. Bunzai keeps your library on your computer and talks only to the AI you choose.</p>' +
        '<p class="muted">Bring cards from</p><div class="apps-row"><span>SillyTavern</span><span>RoleCall</span><span>Chub</span><span>and more</span></div>' +
      '</div><ul class="checks">' +
        check("Encrypted on your machine", "Your characters, chats and keys are locked with encryption.") +
        check("Your own AI key", "Use the provider you like. You pay them directly, if at all.") +
        check("Take it anywhere", "Export to 11 other apps' formats whenever you want.") +
        check("Free and open source", "Anyone can read the code. It will stay free.") +
      '</ul></div></section>' +

      '<section class="band alt"><div class="wrap"><div class="section-head"><h2>Where to next?</h2></div><div class="links-grid">' +
        linkCard("#/features", "Feature tour", "Scenes, Workbench, Library, Press and Agent.") +
        linkCard("#/help", "Guides and help", "Start your first scene or fix a problem.") +
        linkCard("#/download", "Download", "Every system, with sizes and dates.") +
        linkCard("#/whats-new", "What's new", "Every release, newest first.") +
        linkCard("#/try", "Try it in your browser", "Make things with no install.") +
      '</div></div></section>';
  }
  function threeCard(n, ic, t, d, href) {
    return '<a class="card" href="' + href + '"><div class="icon-chip">' + icon(ic) + '</div><span class="num">' + n + '</span><h3>' + t + '</h3><p>' + d + '</p><span class="go">Take the tour ' + icon("i-arrow") + '</span></a>';
  }
  function check(b, s) { return '<li>' + icon("i-check") + '<div><b>' + b + '</b><span>' + s + '</span></div></li>'; }
  function linkCard(href, t, d) { return '<a class="card" href="' + href + '"><h3>' + t + icon("i-arrow") + '</h3><p>' + d + '</p></a>'; }

  function initDemo() {
    var box = $("#demo-reply");
    if (!box) return;
    var i = 0;
    function show(n, animate) {
      i = (n + DEMO.replies.length) % DEMO.replies.length;
      box.innerHTML = DEMO.replies[i]; /* static, authored content */
      $("#demo-count").textContent = (i + 1) + " of " + DEMO.replies.length;
      if (animate && !REDUCED) { box.classList.remove("swap"); void box.offsetWidth; box.classList.add("swap"); }
    }
    $("#demo-prev").addEventListener("click", function () { show(i - 1, true); });
    $("#demo-next").addEventListener("click", function () { show(i + 1, true); });
    $(".demo").addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { show(i - 1, true); e.preventDefault(); }
      if (e.key === "ArrowRight") { show(i + 1, true); e.preventDefault(); }
    });
    var startX = null;
    box.addEventListener("pointerdown", function (e) { startX = e.clientX; });
    box.addEventListener("pointerup", function (e) {
      if (startX == null) return;
      var dx = e.clientX - startX; startX = null;
      if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1), true);
    });
    show(0, false);
  }

  function pageHead(crumbs, eyebrow, title, lede, extra) {
    return '<section class="page-head"><div class="wrap">' +
      (crumbs ? '<nav class="crumbs" aria-label="Breadcrumb">' + crumbs + '</nav>' : "") +
      (eyebrow ? '<span class="eyebrow">' + eyebrow + '</span>' : "") +
      '<h1>' + title + '</h1>' + (lede ? '<p class="lede">' + lede + '</p>' : "") + (extra || "") + '</div></section>';
  }

  function featuresView() {
    return pageHead("", "Feature tour", "Everything Bunzai does.", "Five parts, one app. Start anywhere.") +
      '<div class="wrap feature-index">' + FEATURES.map(function (f, i) {
        return '<a class="card feature-row" href="#/features/' + f.slug + '"><span class="num">0' + (i + 1) + '</span>' +
          '<div><span class="eyebrow" style="margin:0">' + f.verb + '</span><h3>' + f.name + '</h3><p>' + f.blurb + '</p></div>' +
          '<span class="go">' + icon("i-arrow") + '</span></a>';
      }).join("") + '</div>';
  }

  function mockFor(slug) {
    var bar = function (t) { return '<div class="mock-bar"><i></i><i></i><i></i><span>' + t + '</span></div>'; };
    if (slug === "scenes") return '<div class="mock" aria-hidden="true">' + bar("Scene: The Night Train, take 2") + '<div class="mock-body">' +
      '<div class="bubble me">Can I see the note?</div>' +
      '<div class="bubble">She hesitates, then hands it over. The paper is warm, as if someone just...</div>' +
      '<div class="tools"><span class="chip">2 of 4</span><span class="chip">Retry</span><span class="chip hot">Stopped, kept</span><span class="chip">New take</span></div>' +
      '<div class="row"><span>Main prompt</span><span class="toggle on"></span></div>' +
      '<div class="row off"><span>Keep replies short</span><span class="toggle"></span></div>' +
      '<div class="row"><span>Stay in character</span><span class="toggle on"></span></div></div></div>';
    if (slug === "workbench") return '<div class="mock" aria-hidden="true">' + bar("Workbench") + '<div class="mock-body"><div class="panes">' +
      '<div class="pane"><h4>Character</h4><div>Hello, I am <code>{{char}}</code>.</div><div class="line" style="width:90%"></div><div class="line" style="width:70%"></div><div class="line" style="width:80%"></div></div>' +
      '<div class="pane"><h4>Live preview</h4><div>Hello, I am Juniper Hale.</div><div class="line" style="width:85%"></div><div class="line" style="width:60%"></div></div>' +
      '</div><div class="row"><span>Prompt as sent: 6 parts, in order</span><span class="chip">Preview</span></div></div></div>';
    if (slug === "library") return '<div class="mock" aria-hidden="true">' + bar("Library") + '<div class="mock-body">' +
      '<div class="search">' + icon("i-search") + 'Search your library</div><div class="portraits">' +
      portrait("Juniper", "#d9a23b", "#c43d2b") + portrait("Oren", "#3f6b52", "#23392c") + portrait("Mag", "#7a4a8c", "#3b2449") + portrait("Tess", "#c47a4a", "#6b3a22") +
      '</div><div class="row"><span>Trash: 2 items, kept for 3 days</span><span class="chip">Restore</span></div></div></div>';
    if (slug === "press") return '<div class="mock" aria-hidden="true">' + bar("Press: Juniper Hale") + '<div class="mock-body">' +
      '<div class="tools"><span class="chip hot">SillyTavern</span><span class="chip">RoleCall</span><span class="chip">Chub</span><span class="chip">+ 8 more</span></div>' +
      '<div class="warn"><b>This format cannot hold 2 things</b><br>Alternate greetings 3 and 4, and the portrait crop.</div>' +
      '<div class="row"><span>Save as file</span><span class="chip">Export</span></div></div></div>';
    return '<div class="mock" aria-hidden="true">' + bar("Agent") + '<div class="mock-body">' +
      '<div class="bubble me">Fix the typo in every card that says "lightouse".</div>' +
      '<div class="bubble">I found it in 3 cards. Here is what I would change.</div>' +
      '<div class="ask"><b>Change 3 cards?</b><div class="small">Juniper Hale, Oren, The Coast lorebook</div><div class="btns"><span>Yes, change them</span><span>Not now</span></div></div></div></div>';
  }
  function portrait(n, a, b) { return '<div class="portrait" style="--c1:' + a + ';--c2:' + b + '">' + n + '</div>'; }

  function featureView(slug) {
    var idx = -1;
    FEATURES.forEach(function (f, i) { if (f.slug === slug) idx = i; });
    if (idx < 0) return null;
    var f = FEATURES[idx];
    var prev = FEATURES[idx - 1], next = FEATURES[idx + 1];
    return pageHead('<a href="#/features">Feature tour</a><span aria-hidden="true">/</span><span>' + f.name + '</span>', f.verb, f.name, f.intro) +
      '<div class="wrap"><div class="feature-layout"><div>' + f.points.map(function (p) {
        return '<div class="point"><h3>' + esc(p[0]) + '</h3><p>' + esc(p[1]) + '</p></div>';
      }).join("") + '</div>' + mockFor(slug) + '</div>' +
      '<div class="pager">' +
        (prev ? '<a href="#/features/' + prev.slug + '">' + icon("i-left") + '<span><small>Previous</small>' + prev.name + '</span></a>' : '<a href="#/features">' + icon("i-left") + '<span><small>Back to</small>Feature tour</span></a>') +
        (next ? '<a href="#/features/' + next.slug + '" style="text-align:right"><span><small>Next</small>' + next.name + '</span>' + icon("i-right") + '</a>' : '<a href="#/download" style="text-align:right"><span><small>Ready?</small>Download Bunzai</span>' + icon("i-right") + '</a>') +
      '</div></div>';
  }

  function helpView() {
    return pageHead("", "Guides and help", "How can we help?", "Short guides for getting started and getting unstuck.",
      '<div class="search-box" role="search">' + icon("i-search") + '<label class="sr-only" for="help-q">Search the guides</label>' +
      '<input id="help-q" type="search" placeholder="Search, like &quot;swipe&quot; or &quot;backup&quot;" autocomplete="off"></div><p class="result-count" id="help-count" aria-live="polite"></p>') +
      '<div class="wrap" id="help-out"></div>';
  }
  function helpCards() {
    return '<div class="help-grid">' + HELP.map(function (a) {
      return '<a class="card" href="#/help/' + a.slug + '"><h3>' + esc(a.title) + '</h3><p>' + esc(a.summary) + '</p><span class="go">Read ' + icon("i-arrow") + '</span></a>';
    }).join("") + '</div>';
  }
  function highlight(el, text, terms) {
    /* Build text + <mark> nodes. The query never touches innerHTML. */
    if (!terms.length) { el.textContent = text; return; }
    var re = new RegExp("(" + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi");
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      var mk = document.createElement("mark"); mk.textContent = m[0]; el.appendChild(mk);
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }
  function snippet(text, term) {
    var i = text.toLowerCase().indexOf(term);
    if (i < 0) return text.length > 150 ? text.slice(0, 150) + "..." : text;
    var s = Math.max(0, i - 60);
    if (s > 0) { var sp = text.indexOf(" ", s); if (sp > -1 && sp < i) s = sp + 1; }
    return (s > 0 ? "..." : "") + text.slice(s, s + 170) + (s + 170 < text.length ? "..." : "");
  }
  function runSearch(q) {
    var out = $("#help-out"), count = $("#help-count");
    if (!out) return;
    var terms = q.toLowerCase().split(/\s+/).filter(function (t) { return t.length > 1; });
    out.textContent = "";
    if (!terms.length) { out.innerHTML = helpCards(); count.textContent = ""; return; }
    var hits = [];
    HELP.forEach(function (a) {
      var best = null, score = 0;
      var titleHit = terms.every(function (t) { return (a.title + " " + a.summary).toLowerCase().indexOf(t) >= 0; });
      a.sections.forEach(function (s, si) {
        var body = s.p.join(" ");
        var hay = (a.title + " " + s.h + " " + body).toLowerCase();
        if (terms.every(function (t) { return hay.indexOf(t) >= 0; })) {
          var sc = terms.reduce(function (n, t) { return n + (s.h.toLowerCase().indexOf(t) >= 0 ? 3 : 0) + (body.toLowerCase().indexOf(t) >= 0 ? 1 : 0); }, 0);
          if (!best || sc > score) { best = { s: s, si: si, body: body }; score = sc; }
        }
      });
      if (titleHit) score += 5;
      if (best || titleHit) hits.push({ a: a, best: best, score: score });
    });
    hits.sort(function (x, y) { return y.score - x.score; });
    count.textContent = hits.length ? hits.length + (hits.length === 1 ? " guide matches" : " guides match") : "";
    if (!hits.length) {
      var e = document.createElement("div"); e.className = "empty";
      var h = document.createElement("h2"); h.textContent = "Nothing found for “" + q.trim() + "”";
      var p = document.createElement("p"); p.className = "muted";
      p.innerHTML = 'Try a shorter word, or browse <a href="#/help/something-wrong">Something went wrong</a>. You can also <a href="https://github.com/' + REPO + '/issues">ask on GitHub</a>.';
      e.appendChild(h); e.appendChild(p); out.appendChild(e); return;
    }
    var ul = document.createElement("ul"); ul.className = "results";
    hits.forEach(function (hit) {
      var li = document.createElement("li"), a = document.createElement("a");
      a.className = "card";
      a.href = "#/help/" + hit.a.slug + (hit.best ? "?s=" + hit.best.si : "");
      var t = document.createElement("div"); t.className = "r-title"; highlight(t, hit.a.title, terms); a.appendChild(t);
      if (hit.best) {
        var sec = document.createElement("div"); sec.className = "r-sec"; highlight(sec, hit.best.s.h, terms); a.appendChild(sec);
        var sn = document.createElement("div"); sn.className = "r-snip"; highlight(sn, snippet(hit.best.body, terms[0]), terms); a.appendChild(sn);
      } else {
        var su = document.createElement("div"); su.className = "r-snip"; highlight(su, hit.a.summary, terms); a.appendChild(su);
      }
      li.appendChild(a); ul.appendChild(li);
    });
    out.appendChild(ul);
  }
  function initHelp() {
    var input = $("#help-q");
    if (!input) return;
    var last = "";
    try { last = sessionStorage.getItem("bunzai-help-q") || ""; } catch (e) { last = ""; }
    var q = (location.hash.split("?")[1] || "").match(/(?:^|&)q=([^&]*)/);
    if (q) last = decodeURIComponent(q[1].replace(/\+/g, " "));
    input.value = last;
    runSearch(last);
    input.addEventListener("input", function () {
      runSearch(input.value);
      try { sessionStorage.setItem("bunzai-help-q", input.value); } catch (e) { /* ignore */ }
    });
  }

  function articleView(slug) {
    var a = null;
    HELP.forEach(function (x) { if (x.slug === slug) a = x; });
    if (!a) return null;
    var extra = "";
    if (slug === "something-wrong") extra = '<div class="note"><b>Before opening the Windows build</b><p>It is unsigned, so Windows may show a reputation warning. Compare a checksum for this exact file if the release page publishes one. If no checksum is published or it does not match, do not open the download; use the repository\'s build-from-source instructions.</p></div>';
    var others = HELP.filter(function (x) { return x.slug !== slug; }).slice(0, 3);
    return pageHead('<a href="#/help">Guides</a><span aria-hidden="true">/</span><span>' + esc(a.title) + '</span>', "Guide", esc(a.title), esc(a.summary)) +
      '<div class="wrap article"><aside class="toc" aria-label="On this page"><b>On this page</b><ol>' +
        a.sections.map(function (s, i) { return '<li><a href="#/help/' + a.slug + '?s=' + i + '" data-sec="' + i + '">' + esc(s.h) + '</a></li>'; }).join("") +
      '</ol></aside><article class="prose">' + extra +
        a.sections.map(function (s, i) { return '<h2 id="sec-' + i + '" tabindex="-1">' + esc(s.h) + '</h2>' + s.p.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join(""); }).join("") +
        '<div class="note"><b>Still stuck?</b><p>Search the <a href="#/help">guides</a> or <a href="https://github.com/' + REPO + '/issues">ask on GitHub</a>.</p></div>' +
        '<h2 style="font-size:1.2rem">More guides</h2><ul>' + others.map(function (o) { return '<li><a href="#/help/' + o.slug + '">' + esc(o.title) + '</a></li>'; }).join("") + '</ul>' +
      '</article></div>';
  }

  function downloadView() {
    var os = detectOS();
    var mobileNote = os === "mobile" ? '<div class="note"><b>You are on a phone or tablet</b><p>Bunzai is a computer app. Open this page on your computer to download, or <a href="#/try">try the Studio in your browser</a>.</p></div>' : "";
    return pageHead("", "Download", "Get Bunzai.", "Free, for Windows, Mac and Linux. We picked your system for you.") +
      '<div class="wrap"><div class="dl-grid"><div>' + mobileNote + '<div data-slot="ticket"></div>' +
        '<dl class="facts" data-slot="facts"></dl><div class="source-note" data-slot="source"></div></div>' +
        '<div class="card"><h3>Other systems</h3><ul class="others" data-slot="others"></ul></div></div>' +
      '<div class="os-note">' +
        '<div class="card"><div class="icon-chip">' + icon("i-info") + '</div><h3>"Windows doesn\'t recognize this app"</h3>' +
          '<p>This Windows build is unsigned, so Windows may show a reputation warning. That warning does not establish whether a file is safe. Compare a checksum for this exact file if one is published on the release page.</p>' +
          '<p>If no checksum is published or it does not match, do not open the download; use the repository\'s build-from-source instructions.</p></div>' +
        '<div class="card"><div class="icon-chip">' + icon("i-windows") + '</div><h3>Find it again later</h3>' +
          '<p>On first launch, Bunzai adds itself to the Start menu. On a Mac, drag it into Applications. On Linux, the AppImage runs from wherever you save it.</p></div>' +
        '<div class="card"><div class="icon-chip">' + icon("i-browser") + '</div><h3>Not ready to install?</h3>' +
          '<p>The Studio runs in your browser for making and editing. Chatting needs the app.</p><a class="go" href="#/try" style="font-weight:700">Try it ' + icon("i-arrow") + '</a></div>' +
      '</div></div>';
  }

  function whatsNewView() {
    return pageHead("", "What's new", "Every release, newest first.", "Bunzai updates often. Here is what changed and when.", '<div class="source-note" data-slot="source"></div>') +
      '<div class="wrap"><ul class="releases" data-slot="releases"></ul></div>';
  }

  function tryView() {
    return pageHead("", "Try it", "Open the Studio in your browser.", "No install, no account. Make and edit characters, lorebooks and presets right here.") +
      '<div class="wrap"><div class="try-card"><div>' +
        '<h2>The Studio</h2><p class="muted">The same Workbench as the app, running in this tab.</p>' +
        '<ul class="checks" style="margin:20px 0 28px">' +
          check("Make characters", "Write a card from scratch or open one you have.") +
          check("Build lorebooks and presets", "With live macro preview.") +
          check("Export", "Save your work as a file before you close the tab.") +
        '</ul><a class="btn btn-red" href="studio/">Open the Studio ' + icon("i-arrow") + '</a>' +
      '</div><div class="limits"><h3>Good to know</h3><ul class="checks" style="margin-top:14px">' +
        '<li>' + icon("i-info") + '<div><b>Editing only</b><span>The browser Studio makes and edits things. It does not chat.</span></div></li>' +
        '<li>' + icon("i-info") + '<div><b>Kept only while the tab is open</b><span>Close the tab and your work is gone. Export anything you want to keep.</span></div></li>' +
        '<li>' + icon("i-info") + '<div><b>Chatting needs the app</b><span>To play scenes, <a href="#/download">download Bunzai</a>. It is free.</span></div></li>' +
      '</ul></div></div></div>';
  }

  function notFoundView() {
    return pageHead("", "Lost ticket", "We could not find that page.", "It may have moved. Try one of these instead.") +
      '<div class="wrap" style="padding-bottom:72px"><div class="links-grid">' +
        linkCard("#/", "Home", "Start from the front door.") + linkCard("#/features", "Feature tour", "See what Bunzai does.") + linkCard("#/help", "Guides", "Search the help center.") +
      '</div></div>';
  }

  /* ---------- router ---------- */
  function parse() {
    var h = location.hash.replace(/^#/, "") || "/";
    var parts = h.split("?");
    var segs = parts[0].split("/").filter(Boolean);
    return { segs: segs, query: parts[1] || "" };
  }

  function render() {
    var r = parse(), s = r.segs, html = null, title = "", nav = "", after = null;
    if (!s.length) { html = homeView(); title = "Bunzai: AI roleplay on your own computer"; after = initDemo; }
    else if (s[0] === "features" && !s[1]) { html = featuresView(); title = "Feature tour"; nav = "features"; }
    else if (s[0] === "features") { html = featureView(s[1]); title = s[1] ? s[1].charAt(0).toUpperCase() + s[1].slice(1) : ""; nav = "features"; }
    else if (s[0] === "help" && !s[1]) { html = helpView(); title = "Guides and help"; nav = "help"; after = initHelp; }
    else if (s[0] === "help") {
      html = articleView(s[1]); nav = "help";
      HELP.forEach(function (a) { if (a.slug === s[1]) title = a.title; });
      after = function () {
        var m = r.query.match(/(?:^|&)s=(\d+)/);
        if (m) { var t = document.getElementById("sec-" + m[1]); if (t) { t.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }); t.focus({ preventScroll: true }); return true; } }
      };
    }
    else if (s[0] === "download") { html = downloadView(); title = "Download"; nav = "download"; }
    else if (s[0] === "whats-new") { html = whatsNewView(); title = "What's new"; nav = "whats-new"; }
    else if (s[0] === "try") { html = tryView(); title = "Try it in your browser"; nav = "try"; }
    if (html == null) { html = notFoundView(); title = "Page not found"; nav = ""; after = null; }

    var main = $("#main");
    main.innerHTML = html;
    document.title = s.length ? title + " | Bunzai" : title;
    $all(".nav a").forEach(function (a) {
      if (a.getAttribute("data-nav") === nav) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    closeMenu();
    fillReleaseSlots();
    var handled = after ? after() : false;
    if (!handled) {
      window.scrollTo(0, 0);
      if (render.ran) main.focus({ preventScroll: true });
    }
    render.ran = true;
  }

  /* Section links inside an article should not re-render the page. */
  var lastRoute = "";
  function onHash() {
    var r = parse();
    var route = r.segs.join("/");
    if (route === lastRoute && /^help\//.test(route)) {
      var m = r.query.match(/(?:^|&)s=(\d+)/);
      var t = m && document.getElementById("sec-" + m[1]);
      if (t) { t.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }); t.focus({ preventScroll: true }); return; }
    }
    if (route === lastRoute && route === "help") return; /* search query in hash, keep focus in the box */
    lastRoute = route;
    render();
  }

  /* ---------- menu ---------- */
  var menuBtn = $(".menu-btn"), navEl = $("#nav");
  function closeMenu() { navEl.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
  menuBtn.addEventListener("click", function () {
    var open = !navEl.classList.contains("open");
    navEl.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  /* The skip link targets #main, which would otherwise look like a route. */
  $(".skip").addEventListener("click", function (e) { e.preventDefault(); $("#main").focus(); });

  window.addEventListener("hashchange", onHash);
  onHash();
  loadReleases();
})();
