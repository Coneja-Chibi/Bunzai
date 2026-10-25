/*
 * The mascot: a bunny drawn in the house style (hard black outline, flat fills). It blinks on its
 * own, wiggles an ear when you hover, looks toward the pointer, and hops when clicked. `bunny(size,
 * mood)` returns an SVG string built only from constants, so it is safe to place with innerHTML.
 */
(function () {
  var PINK = "var(--cat-pink-soft)";
  function bunny(opts) {
    opts = opts || {};
    var body = opts.body || "var(--paper)";
    var id = "b" + Math.random().toString(36).slice(2, 8);
    return (
      '<svg class="bun ' + (opts.cls || "") + '" viewBox="0 0 200 220" data-bun="' + id + '" aria-hidden="true">' +
      '<g class="ear-l" style="transform-origin:78px 96px"><path d="M62 98 C48 42 58 8 76 8 C94 8 98 50 90 98 Z" fill="' + body + '" stroke="#000" stroke-width="6" stroke-linejoin="round"/><path d="M68 90 C62 54 66 26 76 26 C86 26 86 58 82 90 Z" fill="' + PINK + '"/></g>' +
      '<g class="ear-r" style="transform-origin:122px 96px"><path d="M110 98 C112 46 124 12 142 16 C160 20 150 60 130 100 Z" fill="' + body + '" stroke="#000" stroke-width="6" stroke-linejoin="round"/><path d="M116 90 C120 58 128 34 138 36 C148 38 140 64 126 92 Z" fill="' + PINK + '"/></g>' +
      '<path d="M30 156 C30 112 62 88 100 88 C138 88 170 112 170 156 C170 192 140 212 100 212 C60 212 30 192 30 156 Z" fill="' + body + '" stroke="#000" stroke-width="6"/>' +
      '<g class="eyes"><g class="eye"><ellipse cx="76" cy="146" rx="9" ry="11" fill="#000"/><circle cx="79" cy="141" r="3.2" fill="#fff"/></g>' +
      '<g class="eye"><ellipse cx="124" cy="146" rx="9" ry="11" fill="#000"/><circle cx="127" cy="141" r="3.2" fill="#fff"/></g></g>' +
      '<ellipse cx="58" cy="166" rx="11" ry="6.5" fill="' + PINK + '" opacity=".9"/><ellipse cx="142" cy="166" rx="11" ry="6.5" fill="' + PINK + '" opacity=".9"/>' +
      '<path d="M94 160 L106 160 L100 167 Z" fill="var(--brand)" stroke="#000" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M88 174 Q94 180 100 174 Q106 180 112 174" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round"/>' +
      (opts.bow ? '<g transform="translate(100 96)"><path d="M0 0 L-26 -14 L-26 14 Z M0 0 L26 -14 L26 14 Z" fill="var(--brand)" stroke="#000" stroke-width="5" stroke-linejoin="round"/><rect x="-7" y="-8" width="14" height="16" fill="var(--brand-soft)" stroke="#000" stroke-width="5"/></g>' : "") +
      "</svg>"
    );
  }
  window.bunny = bunny;

  var css = document.createElement("style");
  css.textContent =
    ".bun .ear-l,.bun .ear-r{transition:transform .25s ease-out}" +
    ".bun:hover .ear-r{transform:rotate(24deg)}.bun:hover .ear-l{transform:rotate(-8deg)}" +
    ".bun .eyes{transition:transform .15s ease-out}" +
    ".bun.blink .eye{transform:scaleY(.1);transform-box:fill-box;transform-origin:center}" +
    ".bun.hop{animation:bunhop .5s ease-out}" +
    "@keyframes bunhop{40%{transform:translateY(-18px) rotate(-3deg)}70%{transform:translateY(0)}}" +
    ".stage .bun.hop{animation:bunhopc .5s ease-out}@keyframes bunhopc{40%{transform:translateX(-50%) translateY(-22px)}}" +
    "@media (prefers-reduced-motion:reduce){.bun *{transition:none!important}}";
  document.head.appendChild(css);

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // blink every few seconds, each bunny on its own time
  setInterval(function () {
    if (reduce) return;
    document.querySelectorAll(".bun").forEach(function (b) {
      if (Math.random() < 0.45) { b.classList.add("blink"); setTimeout(function () { b.classList.remove("blink"); }, 140); }
    });
  }, 2600);
  // eyes follow the pointer a little
  window.addEventListener("pointermove", function (e) {
    if (reduce) return;
    document.querySelectorAll(".bun .eyes").forEach(function (g) {
      var r = g.ownerSVGElement.getBoundingClientRect();
      var dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 400));
      var dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / 400));
      g.style.transform = "translate(" + dx * 5 + "px," + dy * 4 + "px)";
    });
  });
  // click to hop
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".bun");
    if (!b || reduce) return;
    b.classList.remove("hop"); void b.getBoundingClientRect(); b.classList.add("hop");
  });
})();
