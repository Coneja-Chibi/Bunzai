/** The scene's scoped accents: whose color wins, where each lands, and that nothing else is painted. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { JSDOM } from "jsdom";
import type { CSSProperties, JSX } from "react";
import type { OpenScene } from "../../../studio/scenes";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { CHAR_TONE, USER_TONE, useSceneAccents } from "./scene-accents";
import { ACCENT_CUSTOM_KEY, ACCENT_SOURCE_KEY, type AccentSource } from "./scene-accent-core";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(async () => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["MutationObserver", "Event"], boundGlobals: ["getComputedStyle"] });
  dom = installed.dom;
  const { themeProperties } = await import("../../shell/theme-tokens");
  const { parseAppearance } = await import("../../../extensions/theme-appearance");
  const m = JSON.parse(readFileSync(new URL("../../../extensions/themes/greenroom/manifest.json", import.meta.url), "utf8")) as { appearance: unknown };
  for (const [prop, value] of Object.entries(themeProperties(parseAppearance(m.appearance, new Set())))) dom.window.document.documentElement.style.setProperty(prop, value);
});
afterAll(() => installed.teardown());

/** `art` is the accent the Studio stamped from each portrait (original["vaud-studio"].unmapped.accent), the Library card's fallback. */
const stampOf = (art?: string): Record<string, unknown> => (art ? { original: { "vaud-studio": { unmapped: { accent: art } } } } : {});
const scene = (character: Record<string, unknown> | undefined, persona: Record<string, unknown> | undefined, stamped?: string, art?: { character?: string; persona?: string }): OpenScene => ({
  chat: { cast: { character: { id: "c", accent: stamped } } },
  snapshot: { character: { body: { presentation: character }, ...stampOf(art?.character) }, ...(persona ? { persona: { body: { presentation: persona }, ...stampOf(art?.persona) } } : {}) },
}) as unknown as OpenScene;
const prefsOf = (source?: AccentSource, custom?: string): { get(key: string): unknown } => ({ get: (key) => (key === ACCENT_SOURCE_KEY ? source : key === ACCENT_CUSTOM_KEY ? custom : undefined) });

async function paintedBy(s: OpenScene | null, prefs = prefsOf()): Promise<Record<string, string>> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const Probe = (): JSX.Element => <i style={useSceneAccents(s, prefs)} />;
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<Probe />));
  const style = (host.firstElementChild as HTMLElement).style;
  const out = Object.fromEntries(Array.from({ length: style.length }, (_, i) => [style.item(i), style.getPropertyValue(style.item(i))]));
  flushSync(() => root.unmount());
  return out;
}

describe("useSceneAccents", () => {
  test("the character's first gradient stop wins over a solid signature, and the persona paints its own scope", async () => {
    const out = await paintedBy(scene({ signatureColor: "#ff0000", gradientColors: ["#008080"] }, { signatureColor: "#ff69b4" }));
    expect(out["--bk-character-accent"]).toBe("#008383");
    expect(out["--bk-scene-accent"]).toBe("#008383");
    expect(Object.keys(out).filter((n) => n.startsWith("--bk-persona-accent")).length).toBe(3);
    expect(out["--bk-persona-accent"]).toBe("#ff69b4");
  });
  test("a card with no authored color wears the accent stamped from its portrait; with neither, nothing is painted", async () => {
    expect((await paintedBy(scene({}, undefined, "#39ff14")))["--bk-character-accent"]).toBe("#39ff14");
    expect(await paintedBy(scene({}, undefined))).toEqual({});
    expect(await paintedBy(null)).toEqual({});
  });
  test("an imported card with no authored color and no frozen cast accent still wears the art accent stamped on its snapshot, as does its persona", async () => {
    const out = await paintedBy(scene({}, {}, undefined, { character: "#39ff14", persona: "#ff69b4" }));
    expect(out["--bk-character-accent"]).toBe("#39ff14");
    expect(out["--bk-scene-accent"]).toBe("#39ff14");
    expect(out["--bk-persona-accent"]).toBe("#ff69b4");
  });
  test("a scene with no persona paints no persona scope", async () => {
    expect(Object.keys(await paintedBy(scene({ signatureColor: "#008080" }, undefined))).some((n) => n.includes("persona"))).toBe(false);
  });
});

describe("message tones", () => {
  const read = (tone: CSSProperties, key: string): string => (tone as Record<string, string>)[key]!;
  test("a character line reads only the scene's scope, falling back to the house accent, and a persona line only the persona's, falling back to its deck hue", () => {
    expect(read(CHAR_TONE, "--tone")).toBe("var(--bk-scene-accent-text,var(--bk-role-brand-text))");
    expect(read(CHAR_TONE, "--tone-fill")).toBe("var(--bk-scene-accent,var(--bk-role-brand))");
    expect(read(USER_TONE, "--tone")).toBe("var(--bk-persona-accent-text,var(--deck-persona))");
    expect(read(USER_TONE, "--tone-fill")).toBe("var(--bk-persona-accent,var(--deck-persona))");
  });
});

describe("the scene accent source", () => {
  const both = scene({ signatureColor: "#008080" }, { signatureColor: "#ff69b4" });
  const sceneHex = async (source?: AccentSource, custom?: string, s: OpenScene = both): Promise<string | undefined> => (await paintedBy(s, prefsOf(source, custom)))["--bk-scene-accent"];
  test("character is the default, and the source never moves the character's or persona's own scope", async () => {
    expect(await sceneHex()).toBe("#008383");
    expect(await sceneHex("character")).toBe("#008383");
    const out = await paintedBy(both, prefsOf("custom", "#ff0000"));
    expect(out["--bk-persona-accent"]).toBe("#ff69b4");
    expect(out["--bk-character-accent"]).toBe("#008383");
  });
  test("persona and custom paint their own colour as the scene accent", async () => {
    expect(await sceneHex("persona")).toBe("#ff69b4");
    expect(await sceneHex("custom", "#ff0000")).toBe("#ff0000");
  });
  test("profile paints the theme's own brand roles, so the user's house accent shows", async () => {
    const out = await paintedBy(both, prefsOf("profile"));
    expect(out["--bk-scene-accent"]).toBe("var(--bk-role-brand)");
    expect(out["--bk-scene-accent-text"]).toBe("var(--bk-role-brand-text)");
    expect(out["--bk-scene-accent-deep"]).toBe("var(--bk-role-brand-deep)");
  });
  test("a source with no colour paints nothing and falls back to the theme, never a hardcoded hex", async () => {
    expect(await sceneHex("persona", undefined, scene({ signatureColor: "#008080" }, undefined))).toBeUndefined();
    expect(await sceneHex("custom", undefined)).toBeUndefined();
    expect(await sceneHex("custom", "not a color")).toBeUndefined();
    expect(await sceneHex("nonsense" as AccentSource)).toBe("#008383");
  });
});
