/** Theme package boundary regressions: data-only descriptors, derived grants, content digest, contrast and registry checks. */
import { describe, expect, test } from "bun:test";
import { inspectThemePackage, isThemePackageId, type ThemePackageInput } from "./theme-contract";
import { exampleThemeInventory, themeInventory } from "./theme-inventory";
import { paletteContrastFailures } from "./theme-appearance";
import { DEFAULT_STUDIO_THEME } from "../studio/settings-shape";

const encore = (await exampleThemeInventory())[0]!;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const pkg = (edit?: (m: Record<string, any>) => void): ThemePackageInput => {
  const out = clone(encore) as { manifest: Record<string, any>; assets: Record<string, string> };
  edit?.(out.manifest);
  return out;
};
const rejects = async (input: unknown, hostId?: string): Promise<string> => (await inspectThemePackage(input, hostId).then(() => "accepted", (e: Error) => e.message));

describe("appearance package public boundary", () => {
  test("overlay cosmetics use the existing surface grant and refuse unrelated layout variants", async () => {
    const preview = await inspectThemePackage(pkg((m) => { m.appearance.surfaces["shell.overlay"] = "hud-widgets"; }));
    expect(preview.appearance.surfaces["shell.overlay"]).toBe("hud-widgets");
    expect(preview.derivedScopes).toContain("appearance.surfaces");
    expect(await rejects(pkg((m) => { m.appearance.surfaces["shell.overlay"] = "tab-bar"; }))).toContain("surface shell.overlay must be one of");
  });
  test("every bundled and example manifest validates against the host registry", async () => {
    for (const input of [...(await themeInventory()), ...(await exampleThemeInventory())]) {
      const id = (input.manifest as { id: string }).id;
      expect((await inspectThemePackage(input, id.startsWith("bunraku.") ? undefined : id)).id).toBe(id);
    }
  });

  test("the default theme paints RoleCall's own colours, over the core rendering, and clears every contrast floor", async () => {
    const input = (await themeInventory()).find((i) => (i.manifest as { id: string }).id === DEFAULT_STUDIO_THEME)!;
    const { appearance } = await inspectThemePackage(input, DEFAULT_STUDIO_THEME);
    expect(paletteContrastFailures(appearance.palette)).toEqual([]);
    // RoleCall's neo-ui canvas, panel, ink and brand rose, its raised surface and its violet accent
    expect(appearance.palette.surface).toMatchObject({ base: "#0a0a0b", panel: "#1c1a22", raised: "#26232d" });
    // apps/rc layout.tsx body text-zinc-100 (Tailwind v4 #f4f4f5), and zinc-400 / zinc-500 for dim text and the control line
    expect(appearance.palette.text).toMatchObject({ text: "#f4f4f5", dim: "#9f9fa9" });
    expect(appearance.palette.line.control).toBe("#71717b");
    expect(appearance.palette.roles.brand.deep).toBe("#e11d48");
    expect(appearance.palette.roles.action.fill).toBe("#a78bfa");
    expect(appearance.surfaces).toEqual({});
    expect(appearance.type).toMatchObject({ display: "cinzel", ui: "system-ui", body: "system-ui", mono: "system-mono" });
    expect(appearance.shape.chrome).toBe("rolecall");
  });

  test("scope derivation matches descriptors and hashes the actual asset bytes", async () => {
    const a = await inspectThemePackage(pkg());
    const b = await inspectThemePackage(pkg((m) => { m.name = "Edited label"; }));
    expect(a.derivedScopes).toEqual(a.requestedScopes);
    expect(a.derivedScopes).toContain("appearance.surfaces");
    expect(a.digest).not.toBe(b.digest);
    const changedAsset = pkg();
    changedAsset.assets["assets/ticket-bun.svg"] = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1 1\"><circle r=\"1\"/></svg>";
    expect((await inspectThemePackage(changedAsset)).digest).not.toBe(a.digest);
  });

  test("license text is optional, bounded in UTF-8 bytes, previewed and covered by approval digest", async () => {
    const without = await inspectThemePackage(pkg());
    const withLicense = await inspectThemePackage({ ...pkg(), licenseText: "Example license" });
    expect(withLicense.licenseText).toBe("Example license");
    expect(withLicense.digest).not.toBe(without.digest);
    expect(await rejects({ ...pkg(), licenseText: "é".repeat(32_001) })).toContain("invalid theme package");
  });

  test("refuses v1 manifests, scope lies, external assets, executable descriptors, and reserved ids", async () => {
    expect(await rejects(pkg((m) => { m.schemaVersion = 1; }))).toContain("invalid theme package");
    const dropped = pkg((m) => { m.requests = m.requests.filter((s: string) => s !== "appearance.surfaces"); });
    expect(await rejects(dropped)).toContain("invalid theme package");
    const lie = pkg((m) => { m.assets = []; m.appearance.marks = {}; });
    lie.assets = {};
    expect(await rejects(lie)).toContain("invalid theme package");
    const external = pkg((m) => { m.assets[0].path = "https://example.com/x.svg"; });
    expect(await rejects(external)).toContain("invalid theme package");
    expect(await rejects(pkg((m) => { m.appearance.extra = "javascript:alert(1)"; }))).toContain("exactly");
    expect(await rejects(pkg((m) => { m.id = "stage"; }))).toContain("invalid theme package");
    expect(await rejects(pkg((m) => { m.id = "greenroom"; }))).toContain("invalid theme package");
  });

  test("refuses unhashed envelope fields, host identity substitution, path tricks, and duplicate requests", async () => {
    expect(await rejects({ ...pkg(), css: "body { display:none }" })).toContain("invalid theme package");
    expect(await rejects(pkg(), "paper")).toContain("invalid theme package");
    const hostIdentity = pkg((m) => { m.id = "paper"; });
    expect((await inspectThemePackage(hostIdentity, "paper")).id).toBe("paper");
    for (const path of ["C:foo.svg", "assets/a.svg:stream", "assets/../a.svg", "assets/a.png", "assets/a\n.svg"]) {
      const hostile = pkg((m) => { m.assets[0].path = path; });
      hostile.assets = { [path]: hostile.assets["assets/ticket-bun.svg"]! };
      expect(await rejects(hostile)).toContain("invalid theme package");
    }
    expect(await rejects(pkg((m) => { m.requests.push("appearance.palette"); }))).toContain("invalid theme package");
  });

  test("shares bounded imported IDs with the persisted theme-setting parser", async () => {
    for (const id of ["bunraku.theme.ab", "bunraku.theme." + "a".repeat(59)]) {
      expect(isThemePackageId(id)).toBe(true);
      expect((await inspectThemePackage(pkg((m) => { m.id = id; }))).id).toBe(id);
    }
    for (const id of ["bunraku.theme.a", "bunraku.theme." + "a".repeat(60), "paper"]) expect(isThemePackageId(id)).toBe(false);
  });

  test("a theme picks only surfaces and variants the host registry knows", async () => {
    expect(await rejects(pkg((m) => { m.appearance.surfaces["shell.nav"] = "raw-css"; }))).toContain("surface shell.nav must be one of");
    expect(await rejects(pkg((m) => { m.appearance.surfaces["shell.nav"] = "tab-bar"; m.appearance.surfaces["shell.sidebar"] = "tab-bar"; }))).toContain("unknown surface");
    expect(await rejects(pkg((m) => { m.appearance.surfaces = { "ui.controls": "legacy" }; }))).toContain("surface ui.controls must be one of");
    const partial = await inspectThemePackage(pkg((m) => { m.appearance.surfaces = { "ui.controls": "game" }; }));
    expect(partial.appearance.surfaces).toEqual({ "ui.controls": "game" });
  });

  test("a palette that misses a contrast floor is rejected, and the failing pair is named", async () => {
    const lowText = await rejects(pkg((m) => { m.appearance.palette.text.text = "#777777"; }));
    expect(lowText).toContain("palette contrast");
    expect(lowText).toContain("text on");
    expect(await rejects(pkg((m) => { m.appearance.palette.roles.danger.text = m.appearance.palette.surface.panel; }))).toContain("roles.danger.text");
    expect(await rejects(pkg((m) => { m.appearance.palette.line.focus = m.appearance.palette.surface.base; }))).toContain("line.focus");
    expect(await rejects(pkg((m) => { m.appearance.palette.text.onDeep = m.appearance.palette.roles.action.deep; }))).toContain("onDeep on roles.action.deep");
  });

  test("raw CSS, URLs, named colors, and partial palettes never reach the descriptor", async () => {
    for (const bad of ["red", "rgb(0,0,0)", "#fff", "#FFFFFF", "url(https://x/y.png)", "#ffffff; background:url(x)"]) {
      expect(await rejects(pkg((m) => { m.appearance.palette.surface.base = bad; }))).toContain("lowercase #rrggbb");
    }
    expect(await rejects(pkg((m) => { m.appearance.type.display = "https://fonts.example/x.woff2"; }))).toContain("type.display must be one of");
    expect(await rejects(pkg((m) => { m.appearance.type.body = "Comic Sans MS"; }))).toContain("type.body must be one of");
    expect(await rejects(pkg((m) => { m.appearance.type.scale = -1; }))).toContain("type.scale");
    expect(await rejects(pkg((m) => { m.appearance.shape.radius = 8; }))).toContain("shape must have exactly");
    expect(await rejects(pkg((m) => { m.appearance.shape.frameWidth = 4; }))).toContain("shape.frameWidth");
    expect(await rejects(pkg((m) => { m.appearance.shape.motion = "wobble"; }))).toContain("shape.motion must be one of");
    expect(await rejects(pkg((m) => { m.appearance.marks.dock = "https://x/y.svg"; }))).toContain("marks.dock");
    expect(await rejects(pkg((m) => { m.appearance.marks.bookFrame = "undeclared"; }))).toContain("marks.bookFrame");
    expect(await rejects(pkg((m) => { delete m.appearance.palette.roles.info; }))).toContain("palette.roles must have exactly");
    expect(await rejects(pkg((m) => { m.appearance.accent = { follows: "always" }; }))).toContain("accent.follows");
  });

  test("admits only bounded inert SVG bytes and canonicalizes semantically unordered input", async () => {
    const unsafe = pkg();
    unsafe.assets["assets/ticket-bun.svg"] = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>";
    expect(await rejects(unsafe)).toContain("invalid theme package");
    const missing = pkg();
    missing.assets = {};
    expect(await rejects(missing)).toContain("invalid theme package");
    const extra = pkg();
    extra.assets["assets/extra.svg"] = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>";
    expect(await rejects(extra)).toContain("invalid theme package");
    const large = pkg();
    large.assets["assets/ticket-bun.svg"] = "<svg xmlns=\"http://www.w3.org/2000/svg\">" + " ".repeat(96_001) + "</svg>";
    expect(await rejects(large)).toContain("invalid theme package");
    const overTotal = pkg();
    for (let i = 0; i < 5; i++) {
      const path = `assets/f${i}.svg`;
      (overTotal.manifest as any).assets.push({ id: `f${i}`, path, mediaType: "image/svg+xml" });
      overTotal.assets[path] = "<svg xmlns=\"http://www.w3.org/2000/svg\">" + " ".repeat(80_000) + "</svg>";
    }
    expect(await rejects(overTotal)).toContain("invalid theme package");

    const withOther = (reverse: boolean): ThemePackageInput => {
      const p = pkg((m) => {
        const other = { id: "other", path: "assets/other.svg", mediaType: "image/svg+xml" };
        if (reverse) { m.assets.unshift(other); m.requests.reverse(); } else m.assets.push(other);
      });
      p.assets["assets/other.svg"] = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>";
      return p;
    };
    expect((await inspectThemePackage(withOther(false))).digest).toBe((await inspectThemePackage(withOther(true))).digest);
  });
});
