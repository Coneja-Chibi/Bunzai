/**
 * The booth's art observer target. `useAsset` starts a load only once its element is on screen, so the
 * element handed to `artRef` has to exist while the booth is still EMPTY; hanging it on the `<img>` (which
 * only renders once art has loaded) meant stored art never loaded and the booth read "no art hung yet".
 */
import { afterAll, afterEach, expect, test } from "bun:test";
import { installDom, teardownAllDoms } from "../../_shared/test-dom";

afterAll(teardownAllDoms);

const dom = installDom('<!doctype html><div id="root"></div>', {
  pretendToBeVisual: true,
  globals: { IS_REACT_ACT_ENVIRONMENT: false }
}).dom;
const elementProto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
elementProto["attachEvent"] = (): void => {};
elementProto["detachEvent"] = (): void => {};

const { flushSync } = await import("react-dom");
const { createRoot } = await import("react-dom/client");
const { TicketWindow } = await import("./index");

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => { flushSync(() => root?.unmount()); root = null; });

function mount(artUrl: string | null, artRef: (el: Element | null) => void): void {
  root = createRoot(dom.window.document.getElementById("root")!);
  flushSync(() => root!.render(<TicketWindow label="portrait" artUrl={artUrl} artRef={artRef} monogram="P" onPick={() => undefined} />));
}

test("an empty booth still hands artRef an element, so stored art can start loading", () => {
  const seen: Element[] = [];
  mount(null, (el) => { if (el) seen.push(el); });
  expect(seen).toHaveLength(1);
  expect(dom.window.document.body.textContent).toContain("no art hung yet");
});

test("the same element stays the target once the art arrives", () => {
  const seen: (Element | null)[] = [];
  mount(null, (el) => { seen.push(el); });
  const first = seen.find((el) => el !== null);
  flushSync(() => root!.render(<TicketWindow label="portrait" artUrl="blob:x" artRef={(el) => { seen.push(el); }} monogram="P" onPick={() => undefined} />));
  expect(dom.window.document.querySelector("img")).not.toBeNull();
  expect(seen.filter((el) => el !== null && el !== first)).toHaveLength(0);
});
