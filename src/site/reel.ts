/**
 * The home page's feature reel, after RoleCall's landing Feature Reel: one "now showing" stage that
 * steps through the cast, each act washing the room in its own color. All slides are in the markup
 * (readable without script); client.ts only switches between them and runs the timer.
 */
import { CAST, visual } from "./tour";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

export function reel(): string {
  const members = [...CAST.slice(1), CAST[0]!];
  const slides = members.map((m, i) => `<article class="slide" id="reel-${m.id}" data-accent="${m.color}" role="tabpanel"${i === 0 ? "" : " hidden"}>
<div class="slide-copy">
<div class="eyebrow">Scene ${ROMAN[i]} &middot; ${m.role}</div>
<h3>${m.title}</h3>
<p class="starring">Starring <b>${m.name}</b></p>
<p class="desc">${m.intro}</p>
<ul class="chips">${m.points.slice(0, 4).map(([title]) => `<li>${title}</li>`).join("")}</ul>
<a class="more" href="tour/${m.id}.html">See ${m.name.replace(/^The /, "the ")} up close &rarr;</a>
</div>
<div class="frame"><span class="br tl"></span><span class="br tr"></span><span class="br bl"></span><span class="br bry"></span>
<div class="nowshow">Now showing</div>
<div class="screen">${visual(m)}</div>
<div class="credits"><div><span>Starring</span>${m.name}</div><div><span>Directed by</span>You</div><div><span>Playing in</span>${m.browser ? "The app and your browser" : "The app"}</div></div>
</div>
</article>`).join("\n");
  const tabs = members.map((m, i) => `<button type="button" class="tab${i === 0 ? " on" : ""}" role="tab" aria-selected="${i === 0}" aria-controls="reel-${m.id}" style="--accent:var(--${m.color})" data-reel-go="${i}"><span class="prog"></span><span class="tab-act">Scene ${ROMAN[i]}</span><span class="tab-name">${m.name}</span></button>`).join("");
  return `<section class="reel" id="tour" data-reel style="--accent:var(--${members[0]!.color})">
<div class="wash"></div>
<div class="wrap reel-inner">
<div class="act"><b>Behind the scenes</b> &middot; the studio</div>
<h2>Build the world<br>behind the conversation.</h2>
${slides}
<div class="reel-controls"><button type="button" class="arrow" data-reel-step="-1" aria-label="Previous scene">&lsaquo;</button><div class="reel-tabs" role="tablist" aria-label="The cast">${tabs}</div><button type="button" class="arrow" data-reel-step="1" aria-label="Next scene">&rsaquo;</button></div>
</div>
</section>`;
}
