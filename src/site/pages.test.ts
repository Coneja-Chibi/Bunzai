/** Public website regression: current branding across nested routes and truthful, usable homepage examples. */
import { expect, test } from 'bun:test';
import { sitePages } from './pages';

test('every website page uses the current mark with project-relative asset paths', () => {
  for (const page of sitePages([])) {
    const prefix = page.path === '404.html' ? '/Bunzai/' : page.path.includes('/') ? '../' : '';
    expect(page.html).toContain(`src="${prefix}media/bunzai-mark.png"`);
    expect(page.html).toContain(`href="${prefix}site.css"`);
    expect(page.html).not.toContain('href="#bun"');
    expect(page.html).not.toContain('id="bun"');
  }
});

test('the auditorium links to a separate info page with product details and existing destinations', () => {
  const pages = sitePages([]);
  const home = pages.find(page => page.path === 'index.html')!.html;
  const info = pages.find(page => page.path === 'info.html')!.html;
  expect(home).toContain('href="info.html"');
  expect(home).toContain('src="media/cinema-auditorium.png"');
  expect(home).toContain('data-screening');
  expect(home).toContain('data-screen-step="1"');
  expect(home).not.toContain('data-scene-example');
  for (const destination of ['download.html', 'studio/', 'guides/getting-started.html', 'guides/importing.html', 'news.html']) {
    expect(info).toContain(`href="${destination}"`);
  }
  expect(info).toContain('A scripted preview. No AI connection needed.');
  expect(info).toContain('Playing scenes needs the installed app.');
  expect(home).not.toContain('ren-cutout');
  expect(home).not.toContain('journey.html');
});
