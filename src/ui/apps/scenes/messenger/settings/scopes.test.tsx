/** Each scope builds its categories from the open scene; scene-stored things sit in the scene scope; missing features are not drawn. */
import { describe, expect, test } from "bun:test";
import type { WingArgs } from "../wing-props";
import type { SceneProp } from "../../props/prop-contract";
import { useMessengerSettings } from "./scopes";

const prop = (id: string, name: string, panel: boolean): SceneProp => ({ id, name, reach: "none", blurb: `${name} blurb`, tier: "t", icon: "lucide:star", tone: "var(--x)", ...(panel ? { panel: "director" as unknown as SceneProp["panel"] } : {}) }) as SceneProp;

function args(over: Partial<WingArgs> = {}): WingArgs {
  return {
    ctx: { prefs: { get: () => undefined, set: () => undefined } },
    scene: { chat: { id: "c1", title: "The flooded archive" }, messages: [], messageCount: 214 },
    name: "Vera", charArt: null, cardPinned: false, registeredProps: [], propsOn: null, setScene: () => undefined, repaint: () => undefined,
    ...over,
  } as unknown as WingArgs;
}
const ids = <T extends { id: string }>(xs: readonly T[]): string[] => xs.map((x) => x.id);

describe("useMessengerSettings", () => {
  test("three scopes with their titles", () => {
    const s = useMessengerSettings(args()).scopes;
    expect([s.user.title, s.character.title, s.scene.title]).toEqual(["You", "Vera", "The flooded archive"]);
    expect(ids(Object.values(s))).toEqual(["user", "character", "scene"]);
    for (const scope of Object.values(s)) for (const c of scope.categories) expect(c.sections.length).toBeGreaterThan(0);
  });

  test("You holds the profile, connection, notices, data, look, accessibility, music and studio pages", () => {
    const { user } = useMessengerSettings(args()).scopes;
    expect(ids(user.categories)).toEqual(["profile", "connection", "notifications", "data", "appearance", "access", "music", "studio"]);
    const look = user.categories.find((c) => c.id === "appearance")!;
    expect(ids(look.sections)).toEqual(["layout", "message", "type", "motion", "chrome", "accent", "theme"]);
  });

  test("the character scope is the card and its starting defaults; per-scene pages are not filed under the character", () => {
    const { character } = useMessengerSettings(args()).scopes;
    expect(ids(character.categories)).toEqual(["overview", "defaults"]);
    const sceneIds = ids(useMessengerSettings(args()).scopes.scene.categories);
    for (const stored of ["world", "booth"]) expect(sceneIds).toContain(stored);
    const world = useMessengerSettings(args()).scopes.scene.categories.find((c) => c.id === "world")!;
    expect(ids(world.sections)).toEqual(["lorebooks", "compendium", "participants"]);
  });

  test("the scene scope places the writing, memory and features tools", () => {
    const { scene } = useMessengerSettings(args()).scopes;
    expect(ids(scene.categories.slice(0, 6))).toEqual(["overview", "booth", "writing", "memory", "world", "features"]);
    expect(ids(scene.categories.find((c) => c.id === "writing")!.sections)).toEqual(["preset", "samplers", "guides", "note", "helpers", "regex", "final-cut"]);
    expect(ids(scene.categories.find((c) => c.id === "memory")!.sections)).toEqual(["summary", "summary-controls", "advanced", "inspector"]);
  });

  test("a Prop with a panel gets a page only while it is on", () => {
    const list = [prop("story-director", "Story Director", true), prop("plain", "Plain", false)];
    const off = useMessengerSettings(args({ registeredProps: list, propsOn: [] })).scopes.scene;
    expect(ids(off.categories)).not.toContain("prop-story-director");
    const on = useMessengerSettings(args({ registeredProps: list, propsOn: ["story-director", "plain"] })).scopes.scene;
    expect(ids(on.categories)).toContain("prop-story-director");
    expect(ids(on.categories)).not.toContain("prop-plain");
  });

  test("features without a store are not drawn", () => {
    const { user, character, scene } = useMessengerSettings(args()).scopes;
    const all = [user, character, scene].flatMap((s) => s.categories.flatMap((c) => ids(c.sections)));
    for (const missing of ["blur", "stream", "pacing", "export", "schedule"]) expect(all).not.toContain(missing);
  });

  test("an unknown deeper page is none", () => { expect(useMessengerSettings(args()).resolveDeep("anything")).toBeNull(); });
});
