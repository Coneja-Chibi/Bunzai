/**
 * Test stand-in for layout: a test DOM measures every element as 0 tall, so a windowed list would draw no rows.
 * This gives the AI wing's scroller (`.wbody`) a viewport size and leaves everything else at 0.
 */
export function fakeScrollerLayout(win: { HTMLElement: { prototype: object } }): void {
  Object.defineProperty(win.HTMLElement.prototype, "offsetHeight", { configurable: true, get(this: HTMLElement) { return this.className.includes("wbody") ? 720 : 0; } });
  Object.defineProperty(win.HTMLElement.prototype, "offsetWidth", { configurable: true, get(this: HTMLElement) { return this.className.includes("wbody") ? 1024 : 0; } });
}
