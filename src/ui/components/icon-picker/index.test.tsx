/** The icon picker chooses from the glyphs the build ships and shows an id it does not ship as no choice. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { installPieceDom, mountNode } from "../../apps/workbench/pieces/fake-piece-rig";
import type { InstalledDom } from "../../_shared/test-dom";
import { IconPicker } from "./index";

let installed: InstalledDom;
beforeAll(() => { installed = installPieceDom(); });
afterAll(() => installed.teardown());

test("an id that is only a word every object has is not a glyph: nothing is shown chosen", async () => {
  const m = await mountNode(<IconPicker value="constructor" onChange={() => undefined} />);
  expect(m.host.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
  await m.unmount();
});

test("a shipped glyph outside the favourites is shown chosen beside them, and None clears it", async () => {
  let seen: string | undefined = "lucide:skull";
  const m = await mountNode(<IconPicker value="lucide:skull" onChange={(v) => { seen = v; }} />);
  expect(m.q('[aria-pressed="true"]').getAttribute("title")).toBe("lucide:skull");
  await m.click(m.button(/^None$/));
  expect(seen).toBeUndefined();
  await m.unmount();
});
