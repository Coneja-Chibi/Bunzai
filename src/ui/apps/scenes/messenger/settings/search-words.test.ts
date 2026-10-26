/** The settings search words: every key names a real section (a renamed section cannot silently lose its words), and the search finds a tool-shaped section by what it holds. */
import { describe, expect, test } from "bun:test";
import { searchSettings } from "../frames/settings-search";
import type { SettingsScope } from "../frames/settings-window";
import type { WingArgs } from "../wing-props";
import type { SceneProp } from "../../props/prop-contract";
import { SECTION_WORDS } from "./search-words";
import { useMessengerSettings } from "./scopes";

const prop = (id: string, name: string): SceneProp => ({ id, name, reach: "none", blurb: `${name} blurb`, tier: "t", icon: "lucide:star", tone: "var(--x)", panel: "director" }) as unknown as SceneProp;
function args(): WingArgs {
  return {
    ctx: { prefs: { get: () => undefined, set: () => undefined } },
    scene: { chat: { id: "c1", title: "The flooded archive" }, messages: [], messageCount: 214 },
    name: "Vera", charArt: null, cardPinned: false, registeredProps: [prop("director", "Story Director")], propsOn: ["director"], setScene: () => undefined, repaint: () => undefined,
  } as unknown as WingArgs;
}
const sectionKeys = (scopes: Record<string, SettingsScope>): Set<string> => new Set(Object.values(scopes).flatMap((sc) => sc.categories.flatMap((c) => c.sections.map((s) => `${sc.id}:${s.id}`))));

describe("settings search words", () => {
  test("every key in the table names a section that exists, except sections that only draw while a feature is on (the Director, trackers, pictures)", () => {
    const real = sectionKeys(useMessengerSettings(args()).scopes);
    const conditional = new Set(["scene:gallery", "scene:wardrobe", "scene:trackers", ...Object.keys(SECTION_WORDS).filter((k) => k.startsWith("scene:director-"))]);
    expect(Object.keys(SECTION_WORDS).filter((k) => !real.has(k) && !conditional.has(k))).toEqual([]);
  });

  test("a tool-shaped section is found by what it holds, not only by its title", () => {
    const s = useMessengerSettings(args()).scopes;
    expect(searchSettings(s["scene"]!, "top p").map((h) => h.sectionId)).toContain("samplers");
    expect(searchSettings(s["scene"]!, "regex").map((h) => h.sectionId)).toContain("regex");
    expect(searchSettings(s["character"]!, "greeting").map((h) => h.sectionId)).toEqual(["card"]);
  });

  test("a preference row's label finds its section in You, so a renamed row is still found", () => {
    const user = useMessengerSettings(args()).scopes.user;
    expect(searchSettings(user, "Response chime").map((h) => h.sectionId)).toEqual(["away"]);
    expect(searchSettings(user, "auto-scroll").map((h) => h.sectionId)).toContain("motion");
  });
});
