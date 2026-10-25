/** Settings > Spotify: the person's own Client ID, the address to register, Connect, and Disconnect, over a scripted fetch. */
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";
import { api } from "../../../api";
import section from "./spotify";

let dom: JSDOM;
let installed: InstalledDom;
let calls: string[];
let status: Record<string, unknown>;
let refuse: string | null;

const stub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const path = new URL(String(input), "http://127.0.0.1:8333").pathname;
  calls.push(`${init?.method ?? "GET"} ${path}${init?.body ? ` ${String(init.body)}` : ""}`);
  if (refuse && path === "/api/spotify/client") return Response.json({ error: refuse }, { status: 400 });
  return Response.json(path === "/api/spotify/status" ? status : path === "/api/spotify/connect" ? { url: "https://accounts.spotify.com/authorize?x=1" } : { ok: true });
};

beforeAll(() => {
  installed = installDom('<!doctype html><html><head><meta name="vaude-session" content="tok"></head><body></body></html>', {
    url: "http://127.0.0.1:8333/",
    extraGlobals: ["SVGElement", "Event", "HTMLInputElement", "HTMLElement"],
    globals: { fetch: stub },
  });
  dom = installed.dom;
});
afterAll(() => installed.teardown());
beforeEach(() => {
  installed.reinstall();
  calls = []; refuse = null;
  status = { clientId: null, connected: false, premium: null, name: null, redirectUri: "http://127.0.0.1:8333/spotify/callback", registerUri: "http://127.0.0.1/spotify/callback" };
});

let root: Root | null = null;
type FlushSync = typeof import("react-dom")["flushSync"];
const settle = async (flushSync: FlushSync, ms = 25): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); };
const doc = (): Document => dom.window.document;
const button = (label: string): HTMLButtonElement | undefined => [...doc().querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
const text = (): string => doc().body.textContent ?? "";
afterEach(async () => {
  const { flushSync } = await import("react-dom");
  if (root) flushSync(() => root!.unmount());
  root = null;
});

async function mount(): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const host = doc().createElement("div");
  doc().body.appendChild(host);
  root = createRoot(host);
  const Section = section.Component;
  flushSync(() => root!.render(<Section ctx={{ api } as never} />));
  await settle(flushSync);
  return flushSync;
}
function type(label: string, value: string): void {
  const el = doc().querySelector(`input[aria-label="${label}"]`)!;
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"))!;
  (el as unknown as Record<string, { onChange(e: { target: { value: string } }): void }>)[key]!.onChange({ target: { value } });
}

test("it names the address to register, with no port, and says what the account needs", async () => {
  await mount();
  expect(text()).toContain("http://127.0.0.1/spotify/callback");
  expect(text()).toContain("Not connected");
  expect(text()).toContain("Premium");
  expect(button("Connect")!.disabled).toBe(true);
});

test("Connect saves the Client ID, then starts the sign-in, and says a browser window opened", async () => {
  const flushSync = await mount();
  flushSync(() => type("Spotify Client ID", "ab".repeat(16)));
  expect(button("Connect")!.disabled).toBe(false);
  flushSync(() => button("Connect")!.click());
  await settle(flushSync, 60);
  expect(calls.filter((c) => c.startsWith("POST"))).toEqual([`POST /api/spotify/client {"clientId":"${"ab".repeat(16)}"}`, "POST /api/spotify/connect {}"]);
  expect(text()).toContain("A browser window opened to sign in to Spotify.");
  expect(text()).toContain("Waiting for Spotify...");
});

test("a Client ID the server refuses is said in its words and no sign-in starts", async () => {
  refuse = "A Spotify Client ID is 32 letters and digits.";
  const flushSync = await mount();
  flushSync(() => type("Spotify Client ID", "nope"));
  flushSync(() => button("Connect")!.click());
  await settle(flushSync, 60);
  expect(text()).toContain("A Spotify Client ID is 32 letters and digits.");
  expect(calls.some((c) => c.includes("/connect"))).toBe(false);
});

test("connected: it says who, offers Disconnect, and Disconnect keeps the Client ID in the field", async () => {
  status = { ...status, clientId: "cd".repeat(16), connected: true, premium: false, name: "Chi" };
  const flushSync = await mount();
  expect(text()).toContain("Connected as Chi, without Premium");
  expect((doc().querySelector('input[aria-label="Spotify Client ID"]') as HTMLInputElement).value).toBe("cd".repeat(16));
  flushSync(() => button("Disconnect")!.click());
  await settle(flushSync, 60);
  expect(calls).toContain("POST /api/spotify/disconnect {}");
});

test("the section never asks for, shows or sends a token or a secret", async () => {
  await mount();
  expect(text().toLowerCase()).not.toContain("client secret");
  expect(doc().querySelector('input[type="password"]')).toBeNull();
});
