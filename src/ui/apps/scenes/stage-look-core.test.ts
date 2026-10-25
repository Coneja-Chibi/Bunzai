/** The Stage look: one default source, every pref parsed at the boundary, out-of-range values read as unset, and what each pref paints on the scene root. */
import { describe, expect, test } from "bun:test";
import { LOOK_DEFAULTS, LOOK_FONTS, LOOK_KEYS, actStatus, autoScrolls, chimeDue, closedActs, lookRoot, readLook, toggleAct } from "./stage-look-core";

const prefs = (rec: Record<string, unknown>) => ({ get: (k: string) => rec[k] });

describe("readLook", () => {
  test("an empty preference record reads as the defaults", () => {
    expect(readLook(prefs({}))).toEqual(LOOK_DEFAULTS);
  });
  test("RoleCall's defaults: Full Stage, smart scroll, typing and fade-in on, chime off, wings pinned with labels, avatars on", () => {
    expect(LOOK_DEFAULTS).toMatchObject({ chatTheme: "stage", autoScroll: "smart", typing: true, fadeIn: true, chime: false, collapse: false, collapseStyle: "single", labels: true, avatars: true, compact: false, font: "default" });
  });
  test("every control round-trips through its key", () => {
    const rec: Record<string, unknown> = {
      [LOOK_KEYS.chatTheme]: "immersive", [LOOK_KEYS.opacity]: 1.5, [LOOK_KEYS.gap]: 24, [LOOK_KEYS.avatars]: false, [LOOK_KEYS.size]: 20, [LOOK_KEYS.font]: "lexend",
      [LOOK_KEYS.colorChar]: "#aabbcc", [LOOK_KEYS.colorUser]: "#112233", [LOOK_KEYS.colorDialogue]: "#ffeedd", [LOOK_KEYS.lineHeight]: 2, [LOOK_KEYS.autoScroll]: "never",
      [LOOK_KEYS.typing]: false, [LOOK_KEYS.fadeIn]: false, [LOOK_KEYS.chime]: true, [LOOK_KEYS.compact]: true, [LOOK_KEYS.collapse]: true, [LOOK_KEYS.collapseStyle]: "segmented", [LOOK_KEYS.labels]: false,
    };
    expect(readLook(prefs(rec))).toEqual({
      chatTheme: "immersive", opacity: 1.5, gap: 24, avatars: false, size: 20, font: "lexend", colorChar: "#aabbcc", colorUser: "#112233", colorDialogue: "#ffeedd", lineHeight: 2,
      autoScroll: "never", typing: false, fadeIn: false, chime: true, compact: true, collapse: true, collapseStyle: "segmented", labels: false,
    });
  });
  test("an out-of-range or malformed value falls to the default, never to a clamp or a throw", () => {
    const bad = readLook(prefs({ [LOOK_KEYS.size]: 99, [LOOK_KEYS.lineHeight]: "tall", [LOOK_KEYS.opacity]: -1, [LOOK_KEYS.gap]: Number.NaN, [LOOK_KEYS.font]: "comic", [LOOK_KEYS.colorChar]: "red", [LOOK_KEYS.autoScroll]: "sometimes", [LOOK_KEYS.chatTheme]: 3, [LOOK_KEYS.typing]: "no" }));
    expect(bad).toEqual(LOOK_DEFAULTS);
  });
  test("Reset writes null, which reads as the default", () => {
    expect(readLook(prefs({ [LOOK_KEYS.size]: null, [LOOK_KEYS.colorChar]: null, [LOOK_KEYS.font]: null }))).toEqual(LOOK_DEFAULTS);
  });
  test("every font choice has a bundled face", () => {
    expect(LOOK_FONTS.map((f) => f.id)).toEqual(["default", "dyslexic", "lexend", "hyperlegible", "serif", "editorial", "mono"]);
  });
});

describe("lookRoot", () => {
  const root = (rec: Record<string, unknown>) => lookRoot(readLook(prefs(rec)));
  test("with nothing set the scene root carries no override, so every theme variant renders as it did", () => {
    expect(root({})).toEqual({ style: undefined, attrs: { "data-chat-theme": "stage", "data-look": "" } });
  });
  test("each type, message and chrome pref paints its own variable and flag", () => {
    const { style, attrs } = root({ [LOOK_KEYS.size]: 18, [LOOK_KEYS.lineHeight]: 2, [LOOK_KEYS.opacity]: 0.5, [LOOK_KEYS.gap]: 8, [LOOK_KEYS.font]: "mono", [LOOK_KEYS.colorChar]: "#aabbcc", [LOOK_KEYS.colorUser]: "#112233", [LOOK_KEYS.colorDialogue]: "#ffeedd" });
    expect(style).toMatchObject({ "--bk-msg-size": "18px", "--bk-msg-lh": "2", "--bk-msg-opacity": "0.5", "--bk-msg-gap": "8px", "--bk-msg-color": "#aabbcc", "--bk-msg-color-user": "#112233", "--bk-msg-dialogue": "#ffeedd" });
    expect(String((style as Record<string, string>)["--bk-msg-font"])).toContain("IBM Plex Mono");
    expect(attrs["data-look"].split(" ").sort()).toEqual(["color", "color-user", "dialogue", "font", "gap", "lh", "opacity", "size"]);
  });
  test("avatars off, compact, collapsed wings (single and segmented), hidden labels and no fade each raise their flag", () => {
    expect(root({ [LOOK_KEYS.avatars]: false, [LOOK_KEYS.compact]: true, [LOOK_KEYS.labels]: false, [LOOK_KEYS.fadeIn]: false }).attrs["data-look"].split(" ").sort()).toEqual(["compact", "noavatar", "nofade", "nolabels"]);
    expect(root({ [LOOK_KEYS.collapse]: true }).attrs["data-look"]).toBe("collapse");
    expect(root({ [LOOK_KEYS.collapse]: true, [LOOK_KEYS.collapseStyle]: "segmented" }).attrs["data-look"].split(" ").sort()).toEqual(["collapse", "segmented"]);
  });
  test("a collapse style with the wings pinned paints nothing", () => {
    expect(root({ [LOOK_KEYS.collapseStyle]: "segmented" }).attrs["data-look"]).toBe("");
  });
  test("Immersive is the Full Stage chrome with the house lights down: its own theme flag and RoleCall's 1.85 line height until one is chosen", () => {
    expect(root({ [LOOK_KEYS.chatTheme]: "immersive" })).toMatchObject({ style: { "--bk-msg-lh": "1.85" }, attrs: { "data-chat-theme": "immersive", "data-look": "lh" } });
    expect(root({ [LOOK_KEYS.chatTheme]: "immersive", [LOOK_KEYS.lineHeight]: 1.2 }).style).toMatchObject({ "--bk-msg-lh": "1.2" });
  });
});

describe("auto-scroll, chime and the act fold", () => {
  test("Always follows every change, Smart follows a reader at the bottom, Never only the scene opening", () => {
    expect([autoScrolls("always", false, false), autoScrolls("smart", true, false), autoScrolls("smart", false, false), autoScrolls("never", true, false), autoScrolls("never", true, true)]).toEqual([true, true, false, false, true]);
  });
  test("the chime sounds when a reply finishes while the tab is away, and only then", () => {
    expect([chimeDue(true, false, true, true), chimeDue(true, false, false, true), chimeDue(false, false, true, true), chimeDue(true, true, true, true), chimeDue(true, false, true, false)]).toEqual([true, false, false, false, false]);
  });
  test("all five acts start open; the fold is a list of closed ids that survives junk", () => {
    expect([...closedActs(undefined)]).toEqual([]);
    expect([...closedActs(["type", "nope", 3])]).toEqual(["type"]);
    expect([...closedActs(toggleAct(closedActs(undefined), "motion"))]).toEqual(["motion"]);
    expect(toggleAct(new Set(["motion"] as const), "motion")).toEqual([]);
  });
  test("a closed act says its state in RoleCall's words", () => {
    const look = readLook(prefs({ [LOOK_KEYS.size]: 18, [LOOK_KEYS.font]: "lexend", [LOOK_KEYS.autoScroll]: "always", [LOOK_KEYS.collapse]: true }));
    expect(actStatus("type", look)).toBe("18px · Lexend");
    expect(actStatus("motion", look)).toBe("Always scroll");
    expect(actStatus("chrome", look)).toBe("Wings collapsed");
    expect(actStatus("chrome", readLook(prefs({})))).toBe("Wings pinned");
    expect(actStatus("motion", readLook(prefs({})))).toBe("Smart scroll");
    expect(actStatus("type", readLook(prefs({})))).toBe("16px · Sans (Default)");
  });
});
