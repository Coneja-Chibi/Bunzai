/** Play the website's keyed curtain entrance once per tab; every exit restores access to the page. */
export function runCurtainIntro(doc: Document, options: { replay?: boolean } = {}): () => void {
  const root = doc.querySelector<HTMLElement>("[data-curtain-intro]");
  const video = root?.querySelector<HTMLVideoElement>("video");
  const skip = root?.querySelector<HTMLButtonElement>("[data-curtain-skip]");
  const win = doc.defaultView;
  if (!root || !video || !skip || !win) return () => {};
  const motion = win.matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.matches) return () => {};
  try { if (!options.replay && win.sessionStorage.getItem("bunzai:curtain-intro")) return () => {}; } catch { /* Storage is optional. */ }

  const siblings = [...doc.body.children].filter((node): node is HTMLElement => node instanceof win.HTMLElement && node !== root);
  const inert = siblings.map(node => node.inert);
  const priorFocus = doc.activeElement;
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    win.clearTimeout(timeout);
    video.pause();
    root.hidden = true;
    doc.documentElement.classList.remove("curtain-active");
    doc.documentElement.classList.add('site-ready');
    doc.dispatchEvent(new win.Event('site-entrance-complete'));
    siblings.forEach((node, index) => { node.inert = inert[index]!; });
    video.removeEventListener("timeupdate", update);
    video.removeEventListener("ended", finish);
    video.removeEventListener("error", finish);
    skip.removeEventListener("click", finish);
    doc.removeEventListener("keydown", keydown);
    motion.removeEventListener("change", finish);
    try { win.sessionStorage.setItem("bunzai:curtain-intro", "seen"); } catch { /* Storage is optional. */ }
    if (root.contains(doc.activeElement)) {
      if (priorFocus instanceof win.HTMLElement && priorFocus !== doc.body) priorFocus.focus({ preventScroll: true });
      else { const main = doc.querySelector<HTMLElement>("main"); if (main) { main.tabIndex = -1; main.focus({ preventScroll: true }); } }
    }
    video.removeAttribute("src");
    video.querySelectorAll("source").forEach(source => source.removeAttribute("src"));
    video.load();
  };
  const update = (): void => {
    root.classList.toggle("zooming", video.currentTime >= 3.6);
    root.classList.toggle("revealing", video.currentTime >= 5.2);
  };
  const keydown = (event: KeyboardEvent): void => { if (event.key === "Escape") finish(); };
  const timeout = win.setTimeout(finish, 9000);
  siblings.forEach(node => { node.inert = true; });
  doc.documentElement.classList.add("curtain-active");
  root.hidden = false;
  skip.focus({ preventScroll: true });
  skip.addEventListener("click", finish);
  doc.addEventListener("keydown", keydown);
  motion.addEventListener("change", finish);
  video.addEventListener("timeupdate", update);
  video.addEventListener("ended", finish);
  video.addEventListener("error", finish);
  video.querySelectorAll<HTMLSourceElement>("source[data-src]").forEach(source => { source.src = source.dataset.src!; });
  video.muted = true;
  video.load();
  try { void video.play().catch(finish); } catch { finish(); }
  return finish;
}
