/**
/**
 * "Add from a link": the one place a picture or video URL typed into the backdrop picker is fetched. The app's page
 * policy lets nothing load from another origin (CSP `img-src 'self' data: blob:`, no frames), so RoleCall's way of showing
 * a URL straight from the browser (BackgroundMedia.tsx) is not available; instead the studio downloads the file once, on
 * the person's click, and stages it like any upload (server-asset-staging.ts), so it is sealed into the pack and the page
 * only ever loads it from itself. The request goes through the vetted-URL egress door (kit/providers/egress.ts
 * guardedFetchVetted): https only, no login, the default port, every address the name resolves to public, the connection
 * pinned to the address that was vetted (no second lookup), at most three redirects each vetted the same way, a 30 s limit
 * and the staging size cap. RoleCall's YouTube refusal is kept (StageSettingsPanel.tsx:700-706); a Vimeo page is not a
 * file and cannot be fetched.
 */
import { assetCapFor } from "./_shared/asset-content";
import { EgressBlocked, guardedFetchVetted, type VettedDeps } from "../kit/providers/egress";
import { extFromMime } from "../core/media/mime";
import { err, readJsonObject } from "./server-security";
import { stageAssetStream } from "./server-asset-staging";

export class FetchRefused extends EgressBlocked {}

const TIMEOUT_MS = 30_000;
/** What a link may serve: the pictures and clips a backdrop takes, and the sound files a Mood Music pack takes. The extension each is staged under comes from the one media table. */
const LINK_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "video/mp4", "video/webm", "video/quicktime", "audio/mpeg", "audio/ogg", "audio/mp4", "audio/wav", "audio/flac", "audio/aac"] as const;
const MIME_EXT: Readonly<Record<string, string>> = Object.fromEntries(LINK_TYPES.map((type) => [type, extFromMime(type)!]));

/** What a person is told when a file passes the size limit for its type. */
const overLimit = (ext: string): string => `That file is over the ${String(assetCapFor(ext) / 1024 / 1024)} MB limit.`;

function platformCheck(url: URL): void {
  if (/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(url.hostname)) throw new FetchRefused("YouTube backgrounds aren't supported because of mid-roll ads. Use a direct picture or video link instead.");
  if (/(^|\.)vimeo\.com$/i.test(url.hostname)) throw new FetchRefused("A Vimeo page is not a file the studio can fetch. Use a direct picture or video link instead.");
}

/** Fetches the link's body through the vetted-URL egress door; returns the response and the file name to stage it under. */
export async function fetchLink(raw: string, signal: AbortSignal, deps?: VettedDeps): Promise<{ response: Response; name: string }> {
  const { response, url } = await guardedFetchVetted(raw, { signal, timeoutMs: TIMEOUT_MS, vetUrl: platformCheck, headers: { accept: "image/*,video/*,audio/*", "user-agent": "Bunraku" } }, deps);
  if (!response.ok || !response.body) throw new FetchRefused(`That link did not answer with a file (${String(response.status)}).`);
  const type = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const fromPath = /\.([a-z0-9]{2,5})$/i.exec(url.pathname)?.[1]?.toLowerCase();
  const ext = MIME_EXT[type] ?? (fromPath && Object.values(MIME_EXT).includes(fromPath) ? fromPath : undefined);
  if (!ext) { await response.body.cancel(); throw new FetchRefused("That link is not a picture, a video or a sound file."); }
  const length = response.headers.get("content-length");
  if (length !== null && Number(length) > assetCapFor(ext)) { await response.body.cancel(); throw new FetchRefused(overLimit(ext)); }
  const stem = decodeURIComponent(url.pathname.split("/").pop() ?? "").replace(/\.[^.]*$/, "").replace(/[^\w .()-]+/g, "").trim() || "link";
  return { response, name: `${stem}.${ext}` };
}

/** POST /api/asset/from-url { url }: the same staged grant as /api/asset/upload, for a file fetched from the link. */
export async function stageAssetFromUrl(req: Request, session: string, isUnlocked: () => Promise<boolean>, deps?: VettedDeps): Promise<Response> {
  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  if (typeof body.value["url"] !== "string") return err("expected { url }", 400);
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(TIMEOUT_MS)]);
  try {
    const { response, name } = await fetchLink(body.value["url"], signal, deps);
    // The body goes straight into the sealed staging pipe: no whole copy of the file, and the link is cancelled at the type's cap.
    const staged = await stageAssetStream(response.body, { filename: name, signal }, session, isUnlocked);
    const tooBig = staged.status === 413 && (await staged.clone().json() as { error?: string }).error === "payload too large";
    return tooBig ? err(overLimit(name.split(".").at(-1) ?? ""), 413) : staged;
  } catch (error) {
    if (error instanceof EgressBlocked) return err(error.message, 400);
    return err("could not fetch that link", 502);
  }
}
