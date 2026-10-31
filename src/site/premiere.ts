/** Website atmosphere reuses the Studio's capped light/fog renderer and one shared motion preference. */
import { startLightRays } from '../ui/components/light-rays/renderer';

export function runPremiere(doc: Document, stopIntro: () => void): () => void {
  const canvas = doc.querySelector<HTMLCanvasElement>('[data-stage-lights]');
  const projector = doc.querySelector<HTMLCanvasElement>('[data-projector-lights]');
  const button = doc.querySelector<HTMLButtonElement>('[data-pause-motion]');
  const win = doc.defaultView;
  if (!canvas || !button || !win) return () => {};
  const preference = win.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  let visible = true;
  let stop: (() => void) | null = null;
  const render = (): void => {
    stop?.();
    stop = null;
    if (visible && !doc.hidden) {
      const animate = !paused && !preference.matches;
      const house = startLightRays(canvas, false, 0, !projector, animate, projector ? 'house' : 'stage');
      const projection = projector ? startLightRays(projector, false, 0, false, animate, 'projector') : null;
      stop = () => { house?.(); projection?.(); };
    }
  };
  const update = (): void => {
    const still = paused || preference.matches;
    doc.documentElement.dataset.motion = still ? 'paused' : 'running';
    button.textContent = preference.matches ? 'Lighting still' : paused ? 'Resume lighting' : 'Pause lighting';
    button.disabled = preference.matches;
    button.setAttribute('aria-pressed', String(still));
    if (still) stopIntro();
    render();
    doc.dispatchEvent(new win.Event('site-motion-change'));
  };
  const toggle = (): void => { paused = !paused; update(); };
  button.addEventListener('click', toggle);
  preference.addEventListener('change', update);
  doc.addEventListener('visibilitychange', render);
  const observer = new win.IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; render(); }, { rootMargin: '80px' });
  observer.observe(canvas);
  if (!doc.documentElement.classList.contains('curtain-active')) doc.documentElement.classList.add('site-ready');
  update();
  return () => {
    stop?.();
    observer.disconnect();
    button.removeEventListener('click', toggle);
    preference.removeEventListener('change', update);
    doc.removeEventListener('visibilitychange', render);
  };
}
