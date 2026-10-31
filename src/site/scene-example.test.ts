/** Exercise the website's public demo form: untrusted text stays text, replies are bounded, reset restores use. */
import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { SCENE_WINDOW } from './tour';
import { runSceneExamples } from './scene-example';

test('typed markup stays text; the bounded conversation can be reset and used again', () => {
  const dom = new JSDOM(SCENE_WINDOW);
  const doc = dom.window.document;
  runSceneExamples(doc);
  const form = doc.querySelector('form')!;
  const input = doc.querySelector('input')!;
  const submit = form.querySelector('button')!;
  const log = doc.querySelector('.scene-transcript')!;
  input.value = '<img src=x onerror=alert(1)>';
  for (let i = 0; i < 4; i++) form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  expect(log.querySelector('img')).toBeNull();
  expect(log.textContent).toContain('<img src=x onerror=alert(1)>');
  expect(log.querySelectorAll('.msg')).toHaveLength(9);
  expect(input.disabled && submit.disabled).toBe(true);
  doc.querySelector<HTMLButtonElement>('[data-scene-reset]')!.click();
  expect(log.querySelectorAll('.msg')).toHaveLength(3);
  expect(input.disabled || submit.disabled).toBe(false);
  form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  expect(log.textContent).toContain('I was looking for a light.');
  const mode = doc.querySelector<HTMLButtonElement>('[data-reading-mode]')!;
  mode.click();
  expect(mode.getAttribute('aria-pressed')).toBe('true');
  expect(doc.querySelector('.scene-example')!.classList.contains('manuscript')).toBe(true);
  dom.window.close();
});
