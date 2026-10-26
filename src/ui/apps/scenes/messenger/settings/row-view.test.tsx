/** The rows draw from the stored value and a change reaches ctx.prefs and the row repaints. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import type { AppContext } from "../../../../app-contract";
import { teardownAllDoms, type InstalledDom } from "../../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../../single-wing-rig";
import { CHAT_LAYOUT_KEY } from "../../chat-layout";
import { LOOK_KEYS } from "../../stage-look-core";
import { RowList } from "./row-view";
import { USER_ROWS as R } from "./rows";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8352); });
afterAll(async () => { await teardownAllDoms(); });

const rig = (): { env: { ctx: AppContext; repaint(): void }; store: Map<string, unknown>; repaints: number[] } => {
  const store = new Map<string, unknown>();
  const repaints: number[] = [];
  return { store, repaints, env: { ctx: { prefs: { get: (k: string) => store.get(k), set: (k: string, v: unknown) => { store.set(k, v); } } } as unknown as AppContext, repaint: () => { repaints.push(1); } } };
};

describe("RowList", () => {
  test("a switch row shows the stored value and writes the flip", async () => {
    const r = rig();
    const m = await mountSingle(installed, createElement(RowList, { rows: [R.avatars], env: r.env }));
    const sw = m.host.querySelector<HTMLElement>('[data-part="scene.messenger.settings.row.toggle.switch"]');
    expect(sw).not.toBeNull();
    expect(sw?.getAttribute("aria-checked") ?? sw?.getAttribute("aria-pressed")).toBe("true");
    sw?.click();
    await new Promise((x) => setTimeout(x, 10));
    expect(r.store.get(LOOK_KEYS.avatars)).toBe(false);
    expect(r.repaints).toHaveLength(1);
    m.done();
  });

  test("the layout radios pick Messenger", async () => {
    const r = rig();
    const m = await mountSingle(installed, createElement(RowList, { rows: [R.layout], env: r.env }));
    const options = [...m.host.querySelectorAll<HTMLElement>('[role="radio"]')];
    expect(options.map((o) => o.getAttribute("aria-checked"))).toEqual(["false", "true"]);
    options[0]?.click();
    await new Promise((x) => setTimeout(x, 10));
    expect(r.store.get(CHAT_LAYOUT_KEY)).toBe("messenger");
    m.done();
  });
});
