/** Public v2 contract for inert, host-rendered appearance packages. */
import { isRecord } from "../core/guards";
import { isInertSvg } from "../ui/_shared/svg-safety";
import { deriveThemeScopes, parseAppearance, THEME_SCOPES, type ThemeAppearance, type ThemeScope } from "./theme-appearance";
import { checkBinary, decodeCanonicalBase64, type BinaryMedia } from "./theme-binary";
import { checkThemeCss } from "./theme-css";
import { parseSlots, slotItemCount, type ThemeSlots } from "./slot-registry";
import { isThemePackageId } from "./theme-id";
export { isThemePackageId } from "./theme-id";
export { THEME_SCOPES, type ThemeAppearance, type ThemeScope } from "./theme-appearance";
export { SLOT_IDS, type SlotId, type SlotItem, type ThemeSlots } from "./slot-registry";

export type ImageMedia = "image/svg+xml" | "image/png" | "image/webp";
export const IMAGE_EXTENSIONS: Record<ImageMedia, string> = { "image/svg+xml": "svg", "image/png": "png", "image/webp": "webp" };
export interface ThemeImage { id: string; path: string; mediaType: ImageMedia }
export interface ThemeFont { id: string; path: string; mediaType: "font/woff2" }
/** `styles`, `fonts` and `slots` are the optional powers beyond the descriptor; each one used derives its own scope. */
export interface ThemePackageManifest {
  schemaVersion: 2;
  id: string;
  version: string;
  name: string;
  requests: ThemeScope[];
  appearance: ThemeAppearance;
  assets: ThemeImage[];
  styles?: "styles.css";
  fonts?: ThemeFont[];
  slots?: ThemeSlots;
}
export interface ThemePackageInput { manifest: unknown; assets: Record<string, unknown>; licenseText?: unknown }
/** `text` is the file as shipped: SVG or CSS source, or the canonical base64 of a binary file. `digest` is the SHA-256 of the bytes served. */
export interface ThemePackagePreview {
  id: string; name: string; version: string; digest: string;
  licenseText?: string;
  requestedScopes: ThemeScope[]; derivedScopes: ThemeScope[];
  appearance: ThemeAppearance;
  assets: (ThemeImage & { digest: string; text: string })[];
  fonts: (ThemeFont & { digest: string; text: string })[];
  styles: string | null;
  slots: ThemeSlots;
}
export interface ThemeFileRef { id: string; url: string; digest: string }
/** `styles` is the checked package CSS with its `url(asset:id)` references unresolved; the shell resolves and scopes it. */
export interface EffectiveThemeAppearance {
  themeId: string | null; packageId: string | null; digest: string | null;
  grantedScopes: ThemeScope[]; appearance: ThemeAppearance | null;
  assets: (ThemeFileRef & { mediaType: ImageMedia })[]; fonts: (ThemeFileRef & { mediaType: "font/woff2" })[];
  styles: string | null; slots: ThemeSlots;
  /** The manifest name, for labels: the host never derives a name from an id. */
  name?: string;
  fallbackReason?: "not-installed" | "disabled" | "revoked" | "invalid-state";
}
const scopes = new Set<string>(THEME_SCOPES);
const reserved = new Set(["paper", "stage", "theater", "girliepop", "greenroom"]);
const MAX_TRANSPORT_BYTES = 384_000;
const MAX_FONTS = 4;
const fail = (): never => { throw new Error("invalid theme package"); };
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const obj = (v: unknown): Record<string, unknown> => isRecord(v) ? v : fail();
const utf8 = (value: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(value);
function stable(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (isRecord(v)) return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
async function hash(value: string | Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", typeof value === "string" ? utf8(value) : value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
const keys = (v: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(v).every((k) => allowed.includes(k));

/** The bytes and content type to serve for a stored theme file (SVG as text, binary decoded from its base64). */
export function themeFileBody(file: { mediaType: ImageMedia | "font/woff2"; text: string }): { type: string; body: string | Uint8Array<ArrayBuffer> } {
  return file.mediaType === "image/svg+xml" ? { type: "image/svg+xml; charset=utf-8", body: file.text } : { type: file.mediaType, body: decodeCanonicalBase64(file.text) };
}

/** The one response for a served theme file: its own type, never sniffed, and sealed so it can run nothing. */
export const themeAssetResponse = (file: { type: string; body: string | Uint8Array<ArrayBuffer> }): Response => new Response(file.body, { headers: {
  "content-type": file.type, "cache-control": "no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox",
} });

/** Parse once, reject unsupported authority, derive exact scopes and digest descriptor plus admitted bytes. */
export async function inspectThemePackage(input: unknown, hostId?: string): Promise<ThemePackagePreview> {
  const root = obj(input);
  if (!keys(root, ["manifest", "assets", "licenseText"])) return fail();
  const licenseText = root.licenseText;
  const licenseBytes = licenseText === undefined ? 0 : typeof licenseText === "string" ? utf8(licenseText).byteLength : Infinity;
  if (licenseBytes > 64_000) return fail();
  const raw = obj(root.manifest);
  if (!keys(raw, ["schemaVersion", "id", "version", "name", "requests", "appearance", "assets", "styles", "fonts", "slots"]) || raw.schemaVersion !== 2) return fail();
  if (!text(raw.id, 80) || (hostId ? raw.id !== hostId : !isThemePackageId(raw.id)) || (hostId && reserved.has(raw.id) && raw.id !== hostId)) return fail();
  if (!text(raw.version, 32) || !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(raw.version) || !text(raw.name, 80)) return fail();
  if (!Array.isArray(raw.assets) || raw.assets.length > 24) return fail();
  const declared = raw.assets.map((v): ThemeImage => {
    const a = obj(v);
    const media = a.mediaType as ImageMedia;
    if (!keys(a, ["id", "path", "mediaType"]) || !text(a.id, 48) || !/^[a-z0-9-]+$/.test(a.id) || !text(a.path, 100) || !Object.prototype.hasOwnProperty.call(IMAGE_EXTENSIONS, media)
      || !new RegExp(`^assets/[a-z0-9][a-z0-9._-]*\\.${IMAGE_EXTENSIONS[media]}$`).test(a.path)) return fail();
    return { id: a.id, path: a.path, mediaType: media };
  });
  const rawFonts = raw.fonts ?? [];
  if (!Array.isArray(rawFonts) || (raw.fonts !== undefined && rawFonts.length === 0) || rawFonts.length > MAX_FONTS) return fail();
  const declaredFonts = rawFonts.map((v): ThemeFont => {
    const f = obj(v);
    if (!keys(f, ["id", "path", "mediaType"]) || !text(f.id, 48) || !/^[a-z0-9-]+$/.test(f.id) || !text(f.path, 100) || !/^fonts\/[a-z0-9][a-z0-9._-]*\.woff2$/.test(f.path) || f.mediaType !== "font/woff2") return fail();
    return { id: f.id, path: f.path, mediaType: "font/woff2" };
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (raw.styles !== undefined && raw.styles !== "styles.css") return fail();
  const hasStyles = raw.styles === "styles.css";
  if (declaredFonts.length > 0 && !hasStyles) return fail();
  const paths = [...declared.map((a) => a.path), ...declaredFonts.map((f) => f.path), ...(hasStyles ? ["styles.css"] : [])];
  const ids = [...declared.map((a) => a.id), ...declaredFonts.map((f) => f.id)];
  if (new Set(ids).size !== ids.length || new Set(paths).size !== paths.length) return fail();
  const imageIds = new Set(declared.map((a) => a.id));
  const appearance = parseAppearance(raw.appearance, imageIds);
  const actual = obj(root.assets);
  if (Object.keys(actual).length !== paths.length || paths.some((p) => !(p in actual))) return fail();
  let total = licenseBytes;
  const spend = (bytes: number): void => { total += bytes; if (total > MAX_TRANSPORT_BYTES) fail(); };
  const sortedAssets = declared.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const assets = await Promise.all(sortedAssets.map(async (a) => {
    const source = actual[a.path];
    if (typeof source !== "string") return fail();
    if (a.mediaType === "image/svg+xml") {
      const bytes = utf8(source);
      if (bytes.byteLength > 96_000 || !isInertSvg(source)) return fail();
      spend(bytes.byteLength);
      return { ...a, digest: await hash(bytes), text: source };
    }
    spend(source.length);
    return { ...a, digest: await hash(checkBinary(a.mediaType as BinaryMedia, source)), text: source };
  }));
  const fonts = await Promise.all(declaredFonts.map(async (f) => {
    const source = actual[f.path];
    if (typeof source !== "string") return fail();
    spend(source.length);
    return { ...f, digest: await hash(checkBinary("font/woff2", source)), text: source };
  }));
  let styles: string | null = null;
  let classes: ReadonlySet<string> = new Set();
  if (hasStyles) {
    const source = actual["styles.css"];
    if (typeof source !== "string") return fail();
    spend(utf8(source).byteLength);
    const report = checkThemeCss(source, { images: imageIds, fonts: new Set(declaredFonts.map((f) => f.id)) });
    if (declaredFonts.some((f) => !report.fontIds.has(f.id))) return fail();
    styles = source;
    classes = report.classes;
  }
  const slots = raw.slots === undefined ? {} : parseSlots(raw.slots, imageIds, classes);
  if (raw.slots !== undefined && slotItemCount(slots) === 0) return fail();
  const derivedScopes = deriveThemeScopes({ assets: assets.length, fonts: fonts.length, styles: styles !== null, slots: slotItemCount(slots) });
  if (!Array.isArray(raw.requests) || raw.requests.length > THEME_SCOPES.length || raw.requests.some((s) => typeof s !== "string" || !scopes.has(s))) return fail();
  const requestedScopes = [...new Set(raw.requests as ThemeScope[])].sort();
  if (requestedScopes.length !== raw.requests.length) return fail();
  if (requestedScopes.length !== derivedScopes.length || requestedScopes.some((s, i) => s !== derivedScopes[i])) return fail();
  const manifest: ThemePackageManifest = { schemaVersion: 2, id: raw.id, version: raw.version, name: raw.name, requests: requestedScopes, appearance, assets: sortedAssets,
    ...(styles !== null ? { styles: "styles.css" as const } : {}), ...(fonts.length ? { fonts: declaredFonts } : {}), ...(raw.slots !== undefined ? { slots } : {}) };
  const files = {
    manifest, assets: assets.map(({ path, text: contents }) => ({ path, contents })), licenseText: licenseText ?? null,
    ...(fonts.length ? { fonts: fonts.map(({ path, text: contents }) => ({ path, contents })) } : {}), ...(styles !== null ? { styles } : {}),
  };
  return { id: manifest.id, name: manifest.name, version: manifest.version, requestedScopes, derivedScopes, appearance, assets, fonts, styles, slots,
    ...(typeof licenseText === "string" ? { licenseText } : {}), digest: await hash(stable(files)) };
}
