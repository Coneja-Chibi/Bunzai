/** The theme projection can only write the declared --bk-* set; protected host tokens are unreachable by any theme. */
import { expect, test } from "bun:test";
import { parseAppearance } from "../../extensions/theme-appearance";
import { inspectThemePackage } from "../../extensions/theme-contract";
import { exampleThemeInventory, themeInventory } from "../../extensions/theme-inventory";
import { THEME_PROPERTY_NAMES, themeProperties } from "./theme-tokens";

const previews = await Promise.all([...(await themeInventory()), ...(await exampleThemeInventory())].map((input) => {
  const id = (input.manifest as { id: string }).id;
  return inspectThemePackage(input, id.startsWith("bunraku.") ? undefined : id);
}));

test("no theme, with or without a user accent, writes anything outside the declared set or any --host-* token", () => {
  const allowed = new Set(THEME_PROPERTY_NAMES);
  for (const p of previews) for (const accent of [undefined, "#12a05f"]) {
    const written = Object.keys(themeProperties(p.appearance, accent));
    expect(written.every((name) => allowed.has(name) && name.startsWith("--bk-")), p.id).toBe(true);
    expect(written.length, p.id).toBe(allowed.size);
  }
});

test("frame, density and motion fields map to fixed values; motion none removes every duration and lift", () => {
  const paper = previews.find((p) => p.id === "paper")!;
  const props = themeProperties({ ...paper.appearance, shape: { ...paper.appearance.shape, frame: "stamp", frameWidth: 3, density: "dense", motion: "none" } });
  expect(props["--bk-frame-w"]).toBe("3px");
  expect(props["--bk-frame-shadow-x"]).toBe("6px");
  expect(props["--bk-density"]).toBe("0.85");
  expect([props["--bk-dur-instant"], props["--bk-dur-fast"], props["--bk-dur-base"], props["--bk-dur-slow"], props["--bk-lift-y"]]).toEqual(["0ms", "0ms", "0ms", "0ms", "0px"]);
  expect(themeProperties({ ...paper.appearance, type: { ...paper.appearance.type, scale: 2 } })["--bk-type-scale"]).toBe("1.125");
});

test("the UI font role and the chrome sizing are required, closed enums at parse time", () => {
  const paper = previews.find((p) => p.id === "paper")!;
  const make = (patch: (a: Record<string, Record<string, unknown>>) => void): unknown => {
    const a = JSON.parse(JSON.stringify(paper.appearance)) as Record<string, Record<string, unknown>>;
    patch(a);
    return a;
  };
  expect(() => parseAppearance(make(() => {}), new Set())).not.toThrow();
  expect(() => parseAppearance(make((a) => { delete a.type!.ui; }), new Set())).toThrow("exactly");
  expect(() => parseAppearance(make((a) => { a.type!.ui = "comic-sans"; }), new Set())).toThrow("type.ui");
  expect(() => parseAppearance(make((a) => { a.shape!.chrome = "round"; }), new Set())).toThrow("shape.chrome");
});
