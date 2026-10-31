/** Exercise the real auditorium's slideshow controls, keyboard access, inert slides and cancellation lifecycle. */
import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { sitePages } from './pages';
import { runScreening } from './screening';

function fixture() {
  const dom = new JSDOM(sitePages([])[0]!.html, { pretendToBeVisual: true, url: 'https://example.test/Bunzai/' });
  const win = dom.window;
  const doc = win.document;
  let callback: (() => void) | undefined;
  let disconnected = false;
  const motion = new win.EventTarget();
  Object.assign(motion, { matches: false });
  Object.defineProperty(win, 'matchMedia', { value: () => motion });
  Object.defineProperty(win, 'setTimeout', { value: (fn: () => void) => { callback = fn; return 1; } });
  Object.defineProperty(win, 'clearTimeout', { value: () => { callback = undefined; } });
  Object.defineProperty(win, 'IntersectionObserver', { value: class {
    observe() {}
    disconnect() { disconnected = true; }
  } });
  const stop = runScreening(doc);
  return { dom, win, doc, motion, stop, scheduled: () => !!callback, disconnected: () => disconnected, advance: () => { const fn = callback; callback = undefined; fn?.(); } };
}

test('movie pictures advance, wrap, support keyboard navigation and exclude inactive slides from interaction', () => {
  const f = fixture();
  const current = () => f.doc.querySelector<HTMLElement>('.screen-slide.is-current')!;
  expect(current().dataset.title).toBe('The opening title');
  expect(f.scheduled()).toBe(false);
  f.doc.querySelector<HTMLButtonElement>('[data-screening-open]')!.click();
  expect(f.doc.querySelector('.auditorium')!.getAttribute('data-screening-state')).toBe('entering');
  expect(current().dataset.title).toBe('The opening title');
  f.advance();
  expect(f.doc.querySelector('.auditorium')!.getAttribute('data-screening-state')).toBe('showing');
  expect(current().dataset.title).toBe('Scenes');
  expect(f.doc.querySelector<HTMLOutputElement>('[data-screening-title]')!.value).toBe('Scenes');
  f.doc.querySelector<HTMLButtonElement>('[data-screen-step="-1"]')!.click();
  expect(current().dataset.title).toBe('The opening title');
  const stage = f.doc.querySelector<HTMLElement>('[data-screening]')!;
  stage.dispatchEvent(new f.win.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  expect(current()).toBe(f.doc.querySelector<HTMLElement>('[data-slide]:last-child')!);
  stage.dispatchEvent(new f.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  expect(current().dataset.title).toBe('The opening title');
  for (const slide of f.doc.querySelectorAll<HTMLElement>('[data-slide]')) expect(slide.inert).toBe(!slide.classList.contains('is-current'));
  f.stop();
  f.dom.window.close();
});

test('interaction, explicit pause, reduced motion, hidden tabs and cleanup cancel automatic playback', () => {
  const f = fixture();
  const stage = f.doc.querySelector<HTMLElement>('[data-screening]')!;
  const play = f.doc.querySelector<HTMLButtonElement>('[data-screening-play]')!;
  expect(f.scheduled()).toBe(false);
  f.doc.querySelector<HTMLButtonElement>('[data-screening-open]')!.click();
  f.advance();
  stage.blur();
  expect(f.scheduled()).toBe(true);
  stage.dispatchEvent(new f.win.Event('mouseenter'));
  expect(f.scheduled()).toBe(false);
  stage.dispatchEvent(new f.win.Event('mouseleave'));
  expect(f.scheduled()).toBe(true);
  play.click();
  expect(f.scheduled()).toBe(false);
  expect(play.getAttribute('aria-pressed')).toBe('true');
  play.click();
  Object.assign(f.motion, { matches: true });
  f.motion.dispatchEvent(new f.win.Event('change'));
  expect(f.scheduled()).toBe(false);
  expect(play.disabled).toBe(true);
  Object.assign(f.motion, { matches: false });
  f.motion.dispatchEvent(new f.win.Event('change'));
  Object.defineProperty(f.doc, 'hidden', { value: true, configurable: true });
  f.doc.dispatchEvent(new f.win.Event('visibilitychange'));
  expect(f.scheduled()).toBe(false);
  Object.defineProperty(f.doc, 'hidden', { value: false, configurable: true });
  f.doc.dispatchEvent(new f.win.Event('visibilitychange'));
  expect(f.scheduled()).toBe(true);
  f.stop();
  expect(f.scheduled()).toBe(false);
  expect(f.disconnected()).toBe(true);
  f.dom.window.close();
});

test('reduced motion opens immediately and teardown cancels a pending entrance', () => {
  const f = fixture();
  Object.assign(f.motion, { matches: true });
  f.doc.querySelector<HTMLButtonElement>('[data-screening-open]')!.click();
  expect(f.doc.querySelector('.auditorium')!.getAttribute('data-screening-state')).toBe('showing');
  expect(f.scheduled()).toBe(false);
  f.stop(); f.dom.window.close();
  const g = fixture();
  g.doc.querySelector<HTMLButtonElement>('[data-screening-open]')!.click();
  g.stop(); g.advance();
  expect(g.doc.querySelector('.auditorium')!.getAttribute('data-screening-state')).toBe('entering');
  g.dom.window.close();
});
