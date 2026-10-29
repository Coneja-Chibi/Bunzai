/** HTTP surface of the optional theme powers: file serving, the broken and healthy reports, and the page CSP that seals them. */
import { describe, expect, test } from "bun:test";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { createThemeLifecycle } from "../extensions/theme-lifecycle";
import { modThemePackage } from "../extensions/theme-mod-fixture";
import { handleThemeRoutes } from "./server-theme-extensions";
import { htmlSecurityHeaders } from "./server-security";

const ID = "bunzai.theme.modtest";
const settings = { read: async () => ({ theme: ID }) } as never;
const get = (path: string): [Request, URL] => { const url = new URL("http://127.0.0.1" + path); return [new Request(url), url]; };
const post = (path: string, body: unknown): [Request, URL] => {
  const url = new URL("http://127.0.0.1" + path);
  return [new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), url];
};
async function installedService() {
  const service = await createThemeLifecycle(memoryStateStore(), []);
  const { preview, challenge } = await service.inspect(await modThemePackage());
  await service.install(challenge, preview.digest, "approve");
  return { service, digest: preview.digest };
}

describe("theme file route", () => {
  test("serves PNG, WebP and woff2 with their own type, no sniffing and a sealed document policy", async () => {
    const { service, digest } = await installedService();
    for (const [id, type] of [["backdrop", "image/png"], ["badge", "image/webp"], ["face", "font/woff2"]] as const) {
      const [req, url] = get(`/api/themes/assets/${ID}/${id}?digest=${digest}`);
      const res = (await handleThemeRoutes(req, url, service, settings))!;
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe(type);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
      expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(8);
    }
    const [req, url] = get(`/api/themes/assets/${ID}/backdrop?digest=${"0".repeat(64)}`);
    expect((await handleThemeRoutes(req, url, service, settings))!.status).toBe(404);
  });

  test("the effective read carries the styles, fonts and slots the shell will paint", async () => {
    const { service } = await installedService();
    const [req, url] = get("/api/themes/effective");
    const body = await (await handleThemeRoutes(req, url, service, settings))!.json() as { styles: string; fonts: unknown[]; slots: Record<string, unknown> };
    expect(body.styles).toContain("@font-face");
    expect(body.fonts).toHaveLength(1);
    expect(Object.keys(body.slots)).toContain("library.header");
  });
});

describe("broken and healthy reports", () => {
  test("a broken report for the painted digest revokes the theme; a stale digest does nothing", async () => {
    const { service, digest } = await installedService();
    const stale = post("/api/themes/broken", { id: ID, digest: "0".repeat(64) });
    expect((await handleThemeRoutes(stale[0], stale[1], service, settings))!.status).toBe(200);
    expect((await service.effective(ID)).digest).toBe(digest);
    const real = post("/api/themes/broken", { id: ID, digest });
    expect((await handleThemeRoutes(real[0], real[1], service, settings))!.status).toBe(200);
    expect(await service.effective(ID)).toMatchObject({ themeId: null, fallbackReason: "revoked" });
  });

  test("a malformed broken report is refused, and healthy resets the launch counter", async () => {
    const { service } = await installedService();
    const bad = post("/api/themes/broken", { id: 5 });
    expect((await handleThemeRoutes(bad[0], bad[1], service, settings))!.status).not.toBe(200);
    const ok = post("/api/themes/healthy", {});
    expect((await handleThemeRoutes(ok[0], ok[1], service, settings))!.status).toBe(200);
  });
});

describe("page CSP", () => {
  const csp = htmlSecurityHeaders("", "'sha256-x'")["content-security-policy"]!;
  const directive = (name: string): string[] => csp.split(";").map((d) => d.trim().split(/\s+/)).find((d) => d[0] === name)?.slice(1) ?? [];
  test("styles, fonts and images load from this origin only: no external host, no wildcard, no scheme source but data and blob images", () => {
    for (const name of ["style-src", "font-src", "img-src", "connect-src"]) {
      for (const source of directive(name)) expect(source, name).not.toMatch(/^(https?:|\*|\/\/|ftp:|wss?:)/);
    }
    expect(directive("font-src")).toEqual(["'self'"]);
    expect(directive("default-src")).toEqual(["'self'"]);
    expect(directive("img-src")).toEqual(["'self'", "data:", "blob:"]);
    expect(directive("script-src")).not.toContain("'unsafe-eval'");
    expect(directive("script-src")).not.toContain("'unsafe-inline'");
    expect(directive("base-uri")).toEqual(["'none'"]);
  });
});
