/**
 * The website's pages as HTML strings: the shared frame (fonts, nav, footer, logo) and every page.
 * Pure; scripts/build-site.ts writes the result into dist/pages. Copy must match the shipped app.
 * Links are relative (`up` climbs out of a subfolder) because Pages serves the site under /Bunzai/.
 */
import type { Guide } from "./guides";
import { reel } from "./reel";
import { CAST, SCENE_WINDOW, tourBody } from "./tour";

export interface Page {
  readonly path: string;
  readonly html: string;
}

const REPO = "https://github.com/Coneja-Chibi/Bunzai";
const LATEST = `${REPO}/releases/latest/download/`;

const LOGO = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="bun" viewBox="0 0 100 100"><g transform="rotate(-8 50 50)">
<path d="M8 24 H92 V40 A8 8 0 0 0 92 56 V76 H8 V56 A8 8 0 0 0 8 40 Z" fill="var(--pink)" stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M64 30 V70" stroke="var(--ink)" stroke-width="2" stroke-dasharray="4 4"/>
<path d="M28 46 C25 30 28 22 32 22 C36 22 36 34 35 46 Z M39 46 C39 31 43 23 47 24 C51 26 47 38 44 47 Z" fill="var(--ink)"/>
<ellipse cx="36" cy="58" rx="13" ry="11" fill="var(--ink)"/><circle cx="78" cy="50" r="6" fill="var(--ink)"/></g></symbol></defs></svg>`;

type Section = "home" | "tour" | "guides" | "news" | "download" | "none";

interface Frame {
  readonly title: string;
  readonly description: string;
  readonly up: string;
  readonly section: Section;
  readonly body: string;
}

function frame({ title, description, up, section, body }: Frame): string {
  const link = (s: Section, href: string, label: string): string =>
    `<a class="link" href="${href}"${s === section ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta name="theme-color" content="#1a1620">
<link rel="icon" href="${up}favicon.ico">
<link rel="stylesheet" href="${up}site.css">
</head>
<body>
${LOGO}
<a class="skip" href="#main">Skip to content</a>
<div class="wrap"><nav class="nav" aria-label="Main">
<a class="brand" href="${up}index.html"><svg width="36" height="36" aria-hidden="true"><use href="#bun"/></svg>bunzai</a>
${link("tour", `${up}tour/scenes.html`, "Tour")}${link("guides", `${up}guides/index.html`, "Guides")}${link("news", `${up}news.html`, "What's new")}<a class="link" href="${up}studio/">Try it</a>
<a class="btn" href="${up}download.html">Download</a>
</nav></div>
<main id="main">
${body}
</main>
<div class="wrap"><footer><span>bunzai &middot; free and open source &middot; a Coneja-Chibi production</span>
<span class="links"><a href="${up}guides/index.html">Guides</a><a href="${up}studio/">Browser Studio</a><a href="${REPO}">GitHub</a><a href="${REPO}/issues">Report a problem</a></span></footer></div>
<script type="module" src="${up}site.js"></script>
</body>
</html>
`;
}

const ticket = (up: string): string => `<div class="ticket">
<div class="adm">ADMIT ONE &middot; ANY NIGHT</div>
<h3>Bunzai</h3>
<p>Free, open source, and yours to keep. No account needed.</p>
<div class="tear"></div>
<div class="os"><a href="${LATEST}Bunzai.exe">Windows</a><a href="${up}download.html#mac">Mac</a><a href="${up}download.html#linux">Linux</a></div>
<small><span data-version>latest</span> &middot; Mac and Linux run from the terminal</small>
</div>`;

const HOME_GUIDES: readonly (readonly [string, string, string])[] = [
  ["getting-started", "Get started", "Install, set up, bring your first file in."],
  ["importing", "Bring your characters", "Import cards from other apps."],
  ["lorebooks", "Lorebooks, gently", "Keep your world straight."],
  ["faq", "Questions people ask", "Where files live, what converts keep."],
];

function home(): Page {
  const body = `<div class="wrap"><header class="hero">
<div>
<div class="act"><b>Act I</b> &middot; hello</div>
<h1>A little theater for your <em>stories</em>.</h1>
<p>Make characters, build their worlds, and play scenes with them using your own AI. Your library stays on your computer, encrypted. No account, no cloud.</p>
<div class="row"><a class="btn" href="download.html">Get Bunzai</a><a class="btn ghost" href="studio/">Try it in your browser</a></div>
<p class="small" style="margin:18px 0 0">Free and open source &middot; Windows, Mac, Linux &middot; <span data-version>latest</span></p>
</div>
<div class="peek"><svg class="bun" aria-hidden="true"><use href="#bun"/></svg>${SCENE_WINDOW}</div>
</header></div>
<div class="dots"></div>
${reel()}
<div class="wrap">
<section class="s"><div class="pair">
<div><div class="act"><b>Act III</b> &middot; what's new</div><h2>Fresh from rehearsal.</h2>
<ul class="news" data-news data-limit="3"><li><div class="v"></div><div><p>Loading the latest releases.</p></div></li></ul>
<a class="more" href="news.html">Every release &rarr;</a></div>
<div id="get"><div class="act"><b>Act IV</b> &middot; your ticket</div>${ticket("")}</div>
</div></section>
<section class="s tight"><div class="act"><b>Act V</b> &middot; guides</div><h2>New here? Start with these.</h2>
<div class="grid-links">${HOME_GUIDES.map(([slug, title, text]) => `<a href="guides/${slug}.html"><div><h3>${title}</h3><p>${text}</p></div><span>&rarr;</span></a>`).join("")}</div>
</section>
</div>
<section class="try-band"><div class="wrap try"><div><div class="act"><b>Encore</b></div>
<h2>Not sure yet? <em>Look around</em> right here.</h2>
<p class="lede">The Studio runs in your browser too. Import a card, edit it, convert it, download it. Nothing is saved there, so download what you make before you close the tab.</p></div>
<a class="btn" href="studio/">Open the Studio</a></div></section>`;
  return { path: "index.html", html: frame({ title: "Bunzai: a little theater for your stories", description: "Make characters, build their worlds, and play scenes with them using your own AI. Free, open source, and private.", up: "", section: "home", body }) };
}

function download(): Page {
  const os = (id: string, name: string, steps: string, extra = ""): string =>
    `<section class="os-block" id="${id}" data-os="${id}"><h2>${name}</h2><ol class="steps">${steps}</ol>${extra}</section>`;
  const body = `<div class="wrap page">
<div class="act"><b>Act IV</b> &middot; your ticket</div>
<h1>Get Bunzai.</h1>
<p class="lede">Free and open source. Every download comes from the latest release on GitHub, <span data-version>latest</span>.</p>
<div class="pair" style="margin-top:36px">
<div>
${os("windows", "Windows", `<li>Download <a class="more" href="${LATEST}Bunzai.exe">Bunzai.exe</a>.</li><li>Double-click it. That is the whole install.</li><li>Windows warns once because the app is new and unsigned: click <b>More info</b>, then <b>Run anyway</b>.</li>`, `<p class="note">App starts but no window? Install Microsoft's <a class="more" href="https://developer.microsoft.com/microsoft-edge/webview2/">WebView2 runtime</a> and open it again. Windows 11 already has it.</p>`)}
${os("mac", "Mac", `<li>Download the one for your Mac: <a class="more" href="${LATEST}bunzai-cli-darwin-arm64">Apple Silicon</a> or <a class="more" href="${LATEST}bunzai-cli-darwin-x64">Intel</a>.</li><li>In Terminal, make it runnable: <code>chmod +x bunzai-cli-darwin-arm64</code></li><li>Start it: <code>./bunzai-cli-darwin-arm64 ui</code></li><li>Open the address it prints in your browser.</li>`)}
${os("linux", "Linux", `<li>Download the one for your machine: <a class="more" href="${LATEST}bunzai-cli-linux-x64">Intel or AMD</a> or <a class="more" href="${LATEST}bunzai-cli-linux-arm64">ARM, like a Raspberry Pi</a>.</li><li>Make it runnable: <code>chmod +x bunzai-cli-linux-x64</code></li><li>Start it: <code>./bunzai-cli-linux-x64 ui</code></li><li>Open the address it prints in your browser.</li>`)}
</div>
<div>${ticket("")}
<p class="note" style="--c:var(--mint)">Your pieces live in <code>Documents/Bunzai Studio</code> on your computer, encrypted. Opening Bunzai again while it is running just opens another window onto the same studio.</p>
<p class="note" style="--c:var(--lilac)"><b>Kit</b>, the optional terminal companion, is a separate download on the <a class="more" href="${REPO}/releases/latest">release page</a>. <a class="more" href="tour/kit.html">What is Kit?</a></p>
<p class="note" style="--c:var(--sky)">Want to check your download? <a class="more" href="${LATEST}SHA256SUMS">SHA256SUMS</a> lists every file's fingerprint.</p>
</div></div>
<section class="s tight" style="padding-top:56px"><h2>Or run it from source</h2>
<p class="lede">You need <a class="more" href="https://bun.sh">Bun</a> 1.3 or newer.</p>
<pre class="source"><code>git clone ${REPO}
cd Bunzai
bun install
bun run dev</code></pre></section>
</div>`;
  return { path: "download.html", html: frame({ title: "Download Bunzai", description: "Get Bunzai for Windows, Mac, or Linux. Free and open source.", up: "", section: "download", body }) };
}

function news(): Page {
  const body = `<div class="wrap page">
<div class="act"><b>Act III</b> &middot; what's new</div>
<h1>Fresh from rehearsal.</h1>
<p class="lede">Every release, newest first, straight from GitHub.</p>
<ul class="news" data-news="full"><li><div class="v"></div><div><p>Loading the releases.</p></div></li></ul>
<a class="more" href="${REPO}/releases">All releases on GitHub &rarr;</a>
</div>`;
  return { path: "news.html", html: frame({ title: "What's new in Bunzai", description: "Every Bunzai release, newest first.", up: "", section: "news", body }) };
}

function notFound(): Page {
  const body = `<div class="wrap page" style="min-height:50vh"><div class="act"><b>Intermission</b></div>
<h1>This page wandered off stage.</h1><p class="lede">It may have moved, or never existed.</p>
<div class="row" style="margin-top:28px"><a class="btn" href="/Bunzai/">Back to the start</a><a class="btn ghost" href="/Bunzai/studio/">Open the Studio</a></div></div>`;
  return { path: "404.html", html: frame({ title: "Not found: Bunzai", description: "This page wandered off stage.", up: "/Bunzai/", section: "none", body }) };
}

const GROUPS: readonly (readonly [string, readonly string[]])[] = [
  ["Start here", ["getting-started", "importing", "library"]],
  ["Make things", ["editing", "lorebooks", "personas", "regex"]],
  ["Send things out", ["exporting", "converting"]],
  ["When you need help", ["faq", "troubleshooting", "security"]],
];

/** Guides grouped for the index and the sidebar; platform notes and anything unlisted go last. */
function grouped(guides: readonly Guide[]): [string, Guide[]][] {
  const bySlug = new Map(guides.map((g) => [g.slug, g]));
  const listed = new Set(GROUPS.flatMap(([, slugs]) => slugs));
  const groups: [string, Guide[]][] = GROUPS.map(([name, slugs]) => [name, slugs.flatMap((s) => bySlug.get(s) ?? [])]);
  groups.push(["Other apps", guides.filter((g) => g.slug.startsWith("platforms"))]);
  groups.push(["More", guides.filter((g) => !listed.has(g.slug) && !g.slug.startsWith("platforms") && g.slug !== "index")]);
  return groups.filter(([, list]) => list.length > 0);
}

function guidePages(guides: readonly Guide[]): Page[] {
  const groups = grouped(guides);
  const side = (current: string): string => `<ul class="side">${groups.map(([name, list]) =>
    `<li class="small">${name}</li>${list.map((g) => `<li><a href="${g.slug}.html"${g.slug === current ? ' aria-current="page"' : ""}>${g.title}</a></li>`).join("")}`).join("")}</ul>`;
  const index = `<div class="wrap page"><div class="act"><b>Act V</b> &middot; guides</div>
<h1>Guides, written for people.</h1><p class="lede">Short, plain how-tos for everything Bunzai does.</p>
${groups.map(([name, list]) => `<div class="act" style="margin-top:44px">${name}</div><div class="grid-links" style="margin-top:0">${list.map((g) => `<a href="${g.slug}.html"><div><h3>${g.title}</h3><p>${g.summary}</p></div><span>&rarr;</span></a>`).join("")}</div>`).join("")}
</div>`;
  const pages: Page[] = [{ path: "guides/index.html", html: frame({ title: "Guides: Bunzai", description: "Short, plain how-tos for everything Bunzai does.", up: "../", section: "guides", body: index }) }];
  for (const g of guides) {
    if (g.slug === "index") continue;
    const body = `<div class="wrap page"><a class="crumb" href="index.html">&larr; All guides</a><div class="guide-wrap">${side(g.slug)}<article class="doc">${g.html}</article></div></div>`;
    pages.push({ path: `guides/${g.slug}.html`, html: frame({ title: `${g.title}: Bunzai`, description: g.summary, up: "../", section: "guides", body }) });
  }
  return pages;
}

/** Every page of the site, given the rendered guides. */
export function sitePages(guides: readonly Guide[]): Page[] {
  const tour = CAST.map((m) => ({
    path: `tour/${m.id}.html`,
    html: frame({ title: `${m.name}: Bunzai`, description: m.card, up: "../", section: "tour", body: tourBody(m) }),
  }));
  return [home(), download(), news(), notFound(), ...tour, ...guidePages(guides)];
}
