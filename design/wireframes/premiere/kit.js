/*
 * Premiere wireframe kit script, WIREFRAMES ONLY. Paints the house palette from one accent the way the app does
 * (src/ui/shell/theme-tokens.ts houseAccentProperties): brand is the accent itself, action and select are its
 * neighbours 28 degrees either side on the wheel. What the earlier pages drew as fixed rose now follows brand, fixed
 * violet follows select, sapphire follows action. The app also nudges each role's lightness to the theme's contrast
 * floors; the wireframe skips that. The accent is remembered per browser so every page in the set agrees.
 */
(function () {
  var KEY = "premiere-wf-accent", DEF = "#e11d48", TURN = 28;
  var SAMPLES = [["Rose", "#e11d48"], ["Violet", "#8b5cf6"], ["Gold", "#c59a46"], ["Teal", "#14b8a6"], ["Sky", "#38bdf8"], ["Peach", "#f08a64"]];

  function toHsv(hex) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0;
    if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
  }
  function toHex(o) {
    var h = ((o.h % 360) + 360) % 360, c = o.v * o.s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = o.v - c;
    var rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return "#" + rgb.map(function (v) { return Math.round((v + m) * 255).toString(16).padStart(2, "0"); }).join("");
  }
  function valid(hex) { return typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex); }
  function read() { try { var v = localStorage.getItem(KEY); return valid(v) ? v : DEF; } catch (e) { return DEF; } }

  function paint(hex) {
    var o = toHsv(hex), brand = hex, action = toHex({ h: o.h + TURN, s: o.s, v: o.v }), select = toHex({ h: o.h - TURN, s: o.s, v: o.v });
    var st = document.documentElement.style;
    st.setProperty("--accent", brand); st.setProperty("--bk-role-brand", brand); st.setProperty("--bk-role-brand-text", brand);
    st.setProperty("--bk-role-action", action); st.setProperty("--bk-role-select", select);
    st.setProperty("--accent-deep", "color-mix(in srgb, " + brand + " 55%, black)");
    st.setProperty("--premiere-rose", brand); st.setProperty("--premiere-violet", select); st.setProperty("--premiere-sapphire", action);
    document.querySelectorAll("[data-accent]").forEach(function (el) { el.setAttribute("aria-pressed", String(el.dataset.accent.toLowerCase() === hex.toLowerCase())); });
    var input = document.getElementById("wf-accent-input"); if (input) input.value = hex;
  }
  function set(hex) { if (!valid(hex)) return; try { localStorage.setItem(KEY, hex); } catch (e) { /* the page still repaints */ } paint(hex); }

  function picker() {
    var note = document.querySelector(".wf-note"); if (!note || document.getElementById("wf-accent")) return;
    var box = document.createElement("span"); box.id = "wf-accent"; box.className = "wf-accent";
    box.innerHTML = "Accent: " + SAMPLES.map(function (s) { return '<button type="button" data-accent="' + s[1] + '" aria-label="' + s[0] + '" style="--c:' + s[1] + '"></button>'; }).join("") +
      '<input id="wf-accent-input" type="color" aria-label="Any accent">';
    note.appendChild(box);
    box.querySelector("input").addEventListener("input", function (e) { set(e.target.value); });
  }

  document.addEventListener("click", function (e) { var t = e.target.closest && e.target.closest("[data-accent]"); if (t) set(t.dataset.accent); });
  window.setLights = function () { /* the light rays are not on room pages */ };
  window.addEventListener("storage", function (e) { if (e.key === KEY && valid(e.newValue)) paint(e.newValue); });
  paint(read());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { picker(); paint(read()); }); else { picker(); paint(read()); }
})();
