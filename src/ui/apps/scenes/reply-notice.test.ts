/** Reply notices without a DOM: the prefs are parsed defensively, and a desktop notice fires only when every condition holds and never carries message text. */
import { describe, expect, test } from "bun:test";
import {
  characterNotify, hideMutedOn, HIDE_MUTED_KEY, MUTED_SCENES_KEY, NOTIFY_KEY, desktopOn, enableDesktop, mutedScenes, replyNotice, setCharacterNotify, setDesktop, setHideMuted, toggleMutedScene,
  type NoticeEnv,
} from "./reply-notice";

const prefsOf = (init: Record<string, unknown> = {}) => {
  const map = new Map(Object.entries(init));
  const writes: unknown[] = [];
  return { get: (k: string) => map.get(k), set: (k: string, v: unknown) => { writes.push(v); map.set(k, v); }, map, writes };
};
const envOf = (over: Partial<NoticeEnv> = {}): NoticeEnv & { shown: { title: string; body: string; tag: string }[]; asked: number } => {
  const shown: { title: string; body: string; tag: string }[] = [];
  const env = { shown, asked: 0, permission: () => "granted" as const, focused: () => false, show: (title: string, body: string, tag: string) => { shown.push({ title, body, tag }); },
    request: async () => { env.asked++; return "granted" as const; }, ...over };
  return env;
};
const who = { characterId: "c1", name: "Mara" };

describe("notification prefs", () => {
  test("unset or malformed prefs read as the defaults, and bad entries are dropped", () => {
    const p = prefsOf({ [NOTIFY_KEY]: "x", [MUTED_SCENES_KEY]: { a: 1 }, [HIDE_MUTED_KEY]: "yes" });
    expect(desktopOn(p)).toBe(false);
    expect(characterNotify(p, "c1")).toBe("all");
    expect(mutedScenes(p)).toEqual([]);
    expect(hideMutedOn(p)).toBe(false);
    const q = prefsOf({ [NOTIFY_KEY]: { desktop: true, byCharacter: { a: "muted", b: "loud", c: 4 } }, [MUTED_SCENES_KEY]: ["s1", 2, "s2"] });
    expect(desktopOn(q)).toBe(true);
    expect(characterNotify(q, "a")).toBe("muted");
    expect(characterNotify(q, "b")).toBe("all");
    expect(mutedScenes(q)).toEqual(["s1", "s2"]);
  });

  test("setting a character keeps the rest, and going back to All drops the entry", () => {
    const p = prefsOf();
    setDesktop(p, true);
    setCharacterNotify(p, "c1", "muted");
    expect(p.get(NOTIFY_KEY)).toEqual({ desktop: true, byCharacter: { c1: "muted" } });
    setCharacterNotify(p, "c1", "all");
    expect(p.get(NOTIFY_KEY)).toEqual({ desktop: true, byCharacter: {} });
  });

  test("muting a scene toggles it in the saved list and returns the list now saved", () => {
    const p = prefsOf();
    expect(toggleMutedScene(p, "s1")).toEqual(["s1"]);
    expect(toggleMutedScene(p, "s2")).toEqual(["s1", "s2"]);
    expect(toggleMutedScene(p, "s1")).toEqual(["s2"]);
    setHideMuted(p, true);
    expect(hideMutedOn(p)).toBe(true);
  });
});

describe("the desktop notice", () => {
  const on = (extra: Record<string, unknown> = {}) => prefsOf({ [NOTIFY_KEY]: { desktop: true, byCharacter: {} }, ...extra });

  test("a reply while the window is away shows 'New reply from X' tagged with the scene, and nothing else", () => {
    const env = envOf();
    replyNotice(on(), "chat1", who, env);
    expect(env.shown).toEqual([{ title: "Bunzai", body: "New reply from Mara", tag: "chat1" }]);
  });

  test("off by default: no notice, and nothing asked", () => {
    const env = envOf();
    replyNotice(prefsOf(), "chat1", who, env);
    expect(env.shown).toEqual([]);
    expect(env.asked).toBe(0);
  });

  test("no notice while the window has focus", () => {
    const env = envOf({ focused: () => true });
    replyNotice(on(), "chat1", who, env);
    expect(env.shown).toEqual([]);
  });

  test("no notice for a muted scene or a muted character, even with the global switch on", () => {
    const env = envOf();
    replyNotice(on({ [MUTED_SCENES_KEY]: ["chat1"] }), "chat1", who, env);
    replyNotice(prefsOf({ [NOTIFY_KEY]: { desktop: true, byCharacter: { c1: "muted" } } }), "chat1", who, env);
    expect(env.shown).toEqual([]);
  });

  test("no notice once permission is not granted any more, and never a permission prompt from a reply", () => {
    const denied = envOf({ permission: () => "denied" });
    const asking = envOf({ permission: () => "default" });
    const gone = envOf({ permission: () => "unsupported" });
    for (const env of [denied, asking, gone]) replyNotice(on(), "chat1", who, env);
    expect([denied.shown, asking.shown, gone.shown]).toEqual([[], [], []]);
    expect(denied.asked + asking.asked + gone.asked).toBe(0);
  });

  test("no notice when the reply is unknown", () => {
    const env = envOf();
    replyNotice(on(), "chat1", null, env);
    expect(env.shown).toEqual([]);
  });
});

describe("turning the desktop notice on", () => {
  test("asks permission once, and the pref turns on only when it is granted", async () => {
    const p = prefsOf();
    const env = envOf({ permission: () => "default" });
    expect(await enableDesktop(p, env)).toBe("on");
    expect(env.asked).toBe(1);
    expect(desktopOn(p)).toBe(true);
  });

  test("a granted permission is not asked for again", async () => {
    const p = prefsOf();
    const env = envOf();
    expect(await enableDesktop(p, env)).toBe("on");
    expect(env.asked).toBe(0);
  });

  test("a refusal keeps the pref off and says so", async () => {
    const p = prefsOf();
    const env = envOf({ permission: () => "default", request: async () => "denied" });
    expect(await enableDesktop(p, env)).toBe("denied");
    expect(desktopOn(p)).toBe(false);
    expect(p.writes).toHaveLength(0);
  });

  test("a browser without notices cannot turn it on", async () => {
    const p = prefsOf();
    expect(await enableDesktop(p, envOf({ permission: () => "unsupported" }))).toBe("unsupported");
    expect(desktopOn(p)).toBe(false);
  });
});
