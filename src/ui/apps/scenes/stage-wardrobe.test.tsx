/**
 * The Stage wing's Wardrobe tab (RoleCall's WardrobeWingPanel): the rack of message themes the scene's regex sets carry. Outfits go in and out
 * of rotation by writing the preset's choice answer, standalone dresses are worn or hung by switching their set on or off for the scene, and the
 * words are never touched. The api is a stand-in that records the writes the scene store would take.
 */
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import type { Chat, ChatRegexPatch } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";
import { installRigDom, props, rig, settle, type FlushSync } from "./fake-scene-page-rig";
import { WARDROBE_TAB } from "./stage-wardrobe";

beforeAll(installRigDom);

const style = (hex: string) => `<style>.a{color:${hex}}</style><div class="a">$0</div>`;
const rule = (id: string, label: string, find: string, replace = style("#ff0000")) => ({ id, label, find, flags: "g", replace, phases: ["display"], enabled: true, sortOrder: 0 });
const SETS: Record<string, unknown> = {
  outfits: { name: "Records", rules: [rule("h", "VI Record - HEARTTHROB", "\\[RECORD: HEARTTHROB\\]", style("#aa0000")), rule("n", "Noir", "\\[RECORD: NOIR\\]"), rule("g", "GHOST", "\\[RECORD: GHOST\\]"), rule("c", "Inline prop", "inline")] },
  dress: { name: "Velvet Dress", rules: [rule("v", "Velvet", "velvet", style("#112233"))] },
  plain: { name: "Plain", rules: [{ ...rule("p", "Cleanup", "x", "y"), phases: ["prompt"] }] },
};
const PRESET = {
  name: "Records", prompts: [],
  choices: [{ id: "troupe", label: "The Records", type: "many", default: ["heartthrob"], options: [{ id: "heartthrob", label: "Heartthrob" }, { id: "noir", label: "Noir" }] }],
};

let chat: Chat;
let writes: ChatRegexPatch[];
let presetOk: boolean;
beforeEach(() => {
  chat = { id: "chat1", title: "t", cast: { character: { id: "v", version: 1 } }, activeBranchId: "b1", createdAt: 1, updatedAt: 1, snapshotVersion: 1, preset: { kind: "preset", id: "records", toggles: {}, samplers: {} }, regex: { sets: ["outfits", "dress", "plain"] } } as Chat;
  writes = []; presetOk = true;
});

const ctx = (): AppContext => ({
  api: {
    listEntities: async () => [],
    getEntity: async (ref: string) => {
      if (ref.startsWith("kind=preset")) { if (!presetOk) throw new Error("gone"); return { body: PRESET }; }
      return { body: SETS[decodeURIComponent(ref.split("id=")[1] ?? "")] };
    },
    setSceneRegex: async (_id: string, patch: ChatRegexPatch) => {
      writes.push(patch);
      const regex = { ...chat.regex, ...(patch.sets ? { sets: patch.sets } : {}), ...(patch.choices ? { choices: { ...chat.regex?.choices, ...Object.fromEntries(Object.entries(patch.choices).map(([p, g]) => [p, { ...chat.regex?.choices?.[p], ...g }])) } } : {}) };
      chat = { ...chat, regex: { ...regex, ...(patch.rack ? { rack: patch.rack } : {}) } } as Chat;
      return chat;
    },
  },
  prefs: { get: () => undefined, set: () => undefined },
}) as unknown as AppContext;

async function mount(): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  rig.host = rig.dom.window.document.createElement("div");
  rig.dom.window.document.body.appendChild(rig.host);
  rig.root = createRoot(rig.host);
  const Panel = WARDROBE_TAB.Panel;
  const render = (): void => flushSync(() => rig.root.render(createElement(Panel, { ctx: ctx(), chat, scene: { chat } as unknown as OpenScene, onChat: (c: Chat) => { chat = c; render(); } })));
  render();
  await settle(flushSync, 30);
  return flushSync;
}
const text = (): string => rig.host.textContent ?? "";
const chip = (name: string): HTMLButtonElement => [...rig.host.querySelectorAll<HTMLElement>(".wd-row")].find((r) => r.textContent?.includes(name))!.querySelector("button")!;
const press = (flushSync: FlushSync, el: Element): void => { flushSync(() => props(el)["onClick"]!({ shiftKey: false })); };
const unmount = (flushSync: FlushSync): void => { flushSync(() => rig.root.unmount()); rig.host.remove(); };

describe("the Wardrobe", () => {
  test("is always offered, and hangs outfits under the group that casts them, standalone dresses apart, unclaimed outfits loose, and counts props", async () => {
    expect(WARDROBE_TAB.visible({ scene: {} as OpenScene, propsOn: null })).toBe(true);
    const flushSync = await mount();
    expect(text()).toContain("The Records");
    expect(text()).toContain("The show decides who takes the stage each beat");
    expect(chip("Heartthrob").textContent).toBe("In rotation");
    expect(chip("Noir").textContent).toBe("Resting");
    expect(text()).toContain("Standalone dresses");
    expect(chip("Velvet").textContent).toBe("Worn");
    expect(text()).toContain("Loose garments");
    expect(text()).toContain("Ghost");
    expect(text()).toContain("No caster found");
    expect(text()).toContain("1 companion props travel with these looks and manage themselves.");
    expect(text()).not.toContain("Cleanup");
    unmount(flushSync);
  });

  test("an outfit goes in and out of rotation by writing the preset's choice answer for this scene", async () => {
    const flushSync = await mount();
    press(flushSync, chip("Noir"));
    await settle(flushSync, 30);
    expect(writes).toEqual([{ choices: { records: { troupe: ["heartthrob", "noir"] } } }]);
    expect(chip("Noir").textContent).toBe("In rotation");
    press(flushSync, chip("Heartthrob"));
    await settle(flushSync, 30);
    expect(writes.at(-1)).toEqual({ choices: { records: { troupe: ["noir"] } } });
    unmount(flushSync);
  });

  test("a standalone dress is hung by switching its set off for the scene, and stays on the scene's rack to be worn again", async () => {
    const flushSync = await mount();
    press(flushSync, chip("Velvet"));
    await settle(flushSync, 40);
    expect(writes).toEqual([{ sets: ["outfits", "plain"], rack: ["dress"] }]);
    expect(chip("Velvet").textContent).toBe("Hang it");
    press(flushSync, chip("Velvet"));
    await settle(flushSync, 40);
    expect(writes.at(-1)).toEqual({ sets: ["outfits", "plain", "dress"], rack: [] });
    expect(chip("Velvet").textContent).toBe("Worn");
    unmount(flushSync);
  });

  test("a dress hung on the rack is still there after a reload: the rack is the scene's own, and a hung set does not dress anything", async () => {
    chat = { ...chat, regex: { sets: ["outfits", "plain"], rack: ["dress"] } } as Chat;
    const flushSync = await mount();
    expect(chip("Velvet").textContent).toBe("Hang it");
    expect(chat.regex?.sets).not.toContain("dress");
    unmount(flushSync);
  });

  test("with no themed set it says the wardrobe is bare, and an unreadable preset is said, never an empty roster", async () => {
    chat = { ...chat, regex: { sets: ["plain"] } } as Chat;
    presetOk = false;
    const flushSync = await mount();
    expect(text()).toContain("The wardrobe is bare");
    expect(text()).toContain("Final Cut wing");
    expect(text()).toContain("This chat's preset could not be read");
    unmount(flushSync);
  });
});
