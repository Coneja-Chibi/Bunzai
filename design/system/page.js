// Spec-page helper for every page under design/system (foundations, builder pages, taste.html).
// 1. Theme switch: g3 / c1 / c3 / paper, from ?theme= or the last pick; fires "bk:theme".
// 2. Width switch for screen mocks: desktop / narrow / phone, from ?width=.
// 3. State strips: [data-set-state] buttons switch the data-state of their variant's .spec-screen.
// 4. Taste picks: on <body data-taste>, every [data-taste-id] gets a pick button and a note box;
//    picks persist in this browser and export as JSON. Wireframe chrome only, never app code.
(function () {
  var THEMES = ["g3", "c1", "c3", "paper"];
  var WIDTHS = ["desktop", "narrow", "phone"];
  var root = document.documentElement;
  var q = new URLSearchParams(location.search);
  function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (text) node.textContent = text;
    return node;
  }

  function setTheme(t) {
    if (THEMES.indexOf(t) < 0) t = "g3";
    root.setAttribute("data-theme", t);
    save("bk-system-theme", t);
    document.querySelectorAll("[data-set-theme]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-set-theme") === t)); });
    document.dispatchEvent(new CustomEvent("bk:theme", { detail: t }));
  }
  function setWidth(w) {
    if (WIDTHS.indexOf(w) < 0) w = "desktop";
    root.setAttribute("data-spec-width", w);
    document.querySelectorAll("[data-set-width]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-set-width") === w)); });
  }

  function buildBar() {
    var bar = el("div", { class: "spec-bar", role: "toolbar", "aria-label": "Preview controls" });
    bar.appendChild(el("span", { class: "bk-label" }, "Theme"));
    THEMES.forEach(function (t) { bar.appendChild(el("button", { type: "button", class: "spec-chip", "data-set-theme": t }, t)); });
    if (document.querySelector(".spec-screen")) {
      bar.appendChild(el("span", { class: "bk-label" }, "Width"));
      WIDTHS.forEach(function (w) { bar.appendChild(el("button", { type: "button", class: "spec-chip", "data-set-width": w }, w)); });
    }
    document.body.appendChild(bar);
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-set-theme")) setTheme(b.getAttribute("data-set-theme"));
      if (b.hasAttribute("data-set-width")) setWidth(b.getAttribute("data-set-width"));
    });
  }

  function itemOf(id) { return id.split(".").slice(0, 2).join("."); }
  function buildTaste() {
    var state = load("bk-taste-v1", { picks: {}, notes: {} });
    var variants = document.querySelectorAll("[data-taste-id]");
    var items = {};
    variants.forEach(function (v) {
      var id = v.getAttribute("data-taste-id");
      items[itemOf(id)] = true;
      var box = el("div", { class: "spec-pick" });
      var pick = el("button", { type: "button", class: "spec-chip", "data-pick": id }, "Pick " + id);
      var note = el("textarea", { class: "spec-note", rows: "2", "aria-label": "Note on " + id, placeholder: "Note for this variant" });
      note.value = state.notes[id] || "";
      note.addEventListener("input", function () { state.notes[id] = note.value; save("bk-taste-v1", state); });
      box.appendChild(pick);
      box.appendChild(note);
      v.appendChild(box);
    });
    var tally = el("span", { class: "bk-meta" });
    function paint() {
      document.querySelectorAll("[data-pick]").forEach(function (b) {
        var id = b.getAttribute("data-pick");
        b.setAttribute("aria-pressed", String(state.picks[itemOf(id)] === id));
      });
      tally.textContent = Object.keys(state.picks).length + " of " + Object.keys(items).length + " picked";
    }
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-pick]");
      if (!b) return;
      var id = b.getAttribute("data-pick");
      var item = itemOf(id);
      if (state.picks[item] === id) delete state.picks[item]; else state.picks[item] = id;
      save("bk-taste-v1", state);
      paint();
    });
    var out = el("button", { type: "button", class: "spec-chip" }, "Export picks");
    out.addEventListener("click", function () {
      var notes = {};
      for (var k in state.notes) if (state.notes[k].trim()) notes[k] = state.notes[k].trim();
      var json = JSON.stringify({ contract: 1, theme: root.getAttribute("data-theme"), exported: new Date().toISOString(), picks: state.picks, notes: notes }, null, 2);
      try { navigator.clipboard.writeText(json); } catch (e) {}
      var a = el("a", { href: URL.createObjectURL(new Blob([json], { type: "application/json" })), download: "bunraku-taste-picks.json" });
      document.body.appendChild(a); a.click(); a.remove();
    });
    var bar = document.querySelector(".spec-bar");
    bar.appendChild(tally);
    bar.appendChild(out);
    paint();
  }

  // State strips: a [data-set-state] button sets data-state on the .spec-screen of its own variant.
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-set-state]");
    if (!b) return;
    var scope = b.closest("[data-taste-id]") || document;
    var screen = scope.querySelector(".spec-screen");
    if (screen) screen.setAttribute("data-state", b.getAttribute("data-set-state"));
    scope.querySelectorAll("[data-set-state]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
  });

  document.addEventListener("DOMContentLoaded", function () {
    buildBar();
    setTheme(q.get("theme") || load("bk-system-theme", "g3"));
    setWidth(q.get("width") || "desktop");
    if (document.body.hasAttribute("data-taste")) buildTaste();
  });
})();
