/**
 * The link fetch guard (server-asset-fetch.ts): which links and addresses are refused before anything is sent, that
 * redirects are re-checked, and that only a picture or video comes back. The network is a stand-in; nothing leaves the machine.
 */
import { expect, test } from "bun:test";
import { EgressBlocked, type VettedDeps } from "../kit/providers/egress";
import { FetchRefused, fetchLink, stageAssetFromUrl } from "./server-asset-fetch";

const png = (): Response => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } });
const signal = new AbortController().signal;
const deps = (answers: Record<string, string[]>, fetches: (url: string) => Response): VettedDeps & { seen: string[] } => {
  const seen: string[] = [];
  return { seen, resolve: async (h) => answers[h] ?? [], send: async ({ url }) => { seen.push(url.href); return fetches(url.href); } };
};

test("a link must be https with no login and the usual port, and YouTube and Vimeo are refused in plain words, before any lookup or request", async () => {
  const d = deps({ "example.com": ["93.184.216.34"] }, png);
  for (const bad of ["http://example.com/a.png", "ftp://example.com/a.png", "file:///etc/passwd", "javascript:alert(1)", "https://u:p@example.com/a.png", "https://example.com:8443/a.png", "nonsense"]) await expect(fetchLink(bad, signal, d)).rejects.toBeInstanceOf(EgressBlocked);
  await expect(fetchLink("https://www.youtube.com/watch?v=x", signal, d)).rejects.toThrow(/mid-roll ads/);
  await expect(fetchLink("https://youtu.be/x", signal, d)).rejects.toThrow(/YouTube/);
  await expect(fetchLink("https://vimeo.com/123", signal, d)).rejects.toThrow(/Vimeo/);
  await expect(fetchLink("https://youtu.be/x", signal, d)).rejects.toBeInstanceOf(FetchRefused);
  expect(d.seen).toEqual([]);
});

test("a name that resolves to any private address is refused before a request is sent", async () => {
  const d = deps({ "evil.example": ["93.184.216.34", "127.0.0.1"], "lan.example": ["192.168.0.5"] }, png);
  await expect(fetchLink("https://evil.example/a.png", signal, d)).rejects.toThrow(/private or local/);
  await expect(fetchLink("https://lan.example/a.png", signal, d)).rejects.toThrow(/private or local/);
  await expect(fetchLink("https://127.0.0.1/a.png", signal, d)).rejects.toThrow(/private or local/);
  await expect(fetchLink("https://[::1]/a.png", signal, d)).rejects.toThrow(/private or local/);
  expect(d.seen).toEqual([]);
});

test("a public picture link is fetched once and named from its path", async () => {
  const d = deps({ "cdn.example": ["93.184.216.34"] }, png);
  const got = await fetchLink("https://cdn.example/pics/Harbor%20Dusk.png?x=1", signal, d);
  expect(got.name).toBe("Harbor Dusk.png");
  expect(d.seen).toEqual(["https://cdn.example/pics/Harbor%20Dusk.png?x=1"]);
});

test("a redirect to a private address or to http is refused, and one to a public https file is followed", async () => {
  const to = (location: string) => (u: string): Response => (u.startsWith("https://cdn.example/start") ? new Response(null, { status: 302, headers: { location } }) : png());
  const answers = { "cdn.example": ["93.184.216.34"], "other.example": ["93.184.216.35"], "inner.example": ["10.0.0.9"] };
  await expect(fetchLink("https://cdn.example/start", signal, deps(answers, to("https://inner.example/a.png")))).rejects.toThrow(/private or local/);
  await expect(fetchLink("https://cdn.example/start", signal, deps(answers, to("http://other.example/a.png")))).rejects.toThrow(/https/);
  const ok = await fetchLink("https://cdn.example/start", signal, deps(answers, to("https://other.example/b.png")));
  expect(ok.name).toBe("b.png");
});

test("a page, an oversized file and a loop of redirects are refused", async () => {
  const answers = { "cdn.example": ["93.184.216.34"] };
  const page = deps(answers, () => new Response("<html></html>", { headers: { "content-type": "text/html" } }));
  await expect(fetchLink("https://cdn.example/page", signal, page)).rejects.toThrow(/not a picture, a video or a sound/);
  const big = deps(answers, () => new Response(new Uint8Array(4), { headers: { "content-type": "image/png", "content-length": String(40 * 1024 * 1024) } }));
  await expect(fetchLink("https://cdn.example/big.png", signal, big)).rejects.toThrow(/10 MB/);
  const video = deps(answers, () => new Response(new Uint8Array(4), { headers: { "content-type": "video/mp4", "content-length": String(20 * 1024 * 1024) } }));
  await expect(fetchLink("https://cdn.example/clip.mp4", signal, video)).resolves.toMatchObject({ name: "clip.mp4" });
  const loop = deps(answers, () => new Response(null, { status: 302, headers: { location: "https://cdn.example/again" } }));
  await expect(fetchLink("https://cdn.example/a", signal, loop)).rejects.toThrow(/redirected too many times/);
  expect(loop.seen.length).toBe(4);
});

test("a link with no length that runs past the cap is cancelled upstream and refused with the 32 MB words", async () => {
  const chunk = new Uint8Array(4 * 1024 * 1024);
  const state = { cancelled: false };
  const body = new ReadableStream<Uint8Array>({ pull: (c) => c.enqueue(chunk), cancel() { state.cancelled = true; } });
  const d = deps({ "cdn.example": ["93.184.216.34"] }, () => new Response(body, { headers: { "content-type": "video/mp4" } }));
  const res = await stageAssetFromUrl(new Request("http://x/api/asset/from-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://cdn.example/a.mp4" }) }), "session", async () => true, d);
  expect(res.status).toBe(413);
  expect((await res.json() as { error: string }).error).toMatch(/32 MB/);
  expect(state.cancelled).toBe(true);
});

test("a sound file link is fetched like a clip, held to the media cap, and a page still is not", async () => {
  const answers = { "cdn.example": ["93.184.216.34"] };
  const song = (type: string, length = "1000") => deps(answers, () => new Response(new Uint8Array(4), { headers: { "content-type": type, "content-length": length } }));
  await expect(fetchLink("https://cdn.example/Tavern%20Night.mp3", signal, song("audio/mpeg"))).resolves.toMatchObject({ name: "Tavern Night.mp3" });
  await expect(fetchLink("https://cdn.example/a", signal, song("audio/ogg"))).resolves.toMatchObject({ name: "a.ogg" });
  await expect(fetchLink("https://cdn.example/big.mp3", signal, song("audio/mpeg", String(40 * 1024 * 1024)))).rejects.toThrow(/32 MB/);
});
