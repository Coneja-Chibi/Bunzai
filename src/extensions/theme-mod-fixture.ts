/** Test stand-ins for the optional powers: structurally valid PNG, WebP and woff2 bytes, and a package that uses every power. */
import { crc32 } from "./theme-binary";
import type { ThemePackageInput } from "./theme-contract";
import { fixtureThemePackage } from "./theme-test-fixture";

const be32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n: number): number[] => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
const base64 = (bytes: number[]): string => btoa(String.fromCharCode(...bytes));
const chunk = (type: string, data: number[]): number[] => [...be32(data.length), ...ascii(type), ...data, ...be32(crc32(new Uint8Array([...ascii(type), ...data])))];

/** `pad` adds filler bytes to the image data, to build a valid file of any size. */
export const pngBytes = (w = 2, h = 2, pad = 0): number[] => [137, 80, 78, 71, 13, 10, 26, 10, ...chunk("IHDR", [...be32(w), ...be32(h), 8, 6, 0, 0, 0]), ...chunk("IDAT", [1, 2, 3, 4, ...new Array<number>(pad).fill(7)]), ...chunk("IEND", [])];
export const webpBytes = (w = 2, h = 2): number[] => {
  const body = [0x2f, ...le32((w - 1) | ((h - 1) << 14)), 0];
  const chunks = [...ascii("VP8L"), ...le32(5), ...body];
  return [...ascii("RIFF"), ...le32(4 + chunks.length), ...ascii("WEBP"), ...chunks];
};
export const woff2Bytes = (size = 64): number[] => { const b = new Array<number>(size).fill(0); b.splice(0, 4, ...ascii("wOF2")); b.splice(4, 4, ...be32(0x00010000)); b.splice(8, 4, ...be32(size)); b.splice(12, 2, 0, 1); b.splice(16, 4, ...be32(1024)); return b; };
export const png = (w?: number, h?: number): string => base64(pngBytes(w, h));
export const webp = (w?: number, h?: number): string => base64(webpBytes(w, h));
export const woff2 = (): string => base64(woff2Bytes());
export { base64 };

export const MOD_STYLES = `
@font-face { font-family: "Marquee Face"; src: url(asset:face) format("woff2"); font-display: swap; }
@keyframes drift { from { opacity: 0.6; } to { opacity: 1; } }
.mod-stamp-note { font-family: "Marquee Face", serif; letter-spacing: 0.04em; }
body { background: url(asset:backdrop) center / cover no-repeat; }
.library-card:hover { transform: rotate(-1deg); animation: drift 2s infinite alternate; }
.library-card::before { content: "new"; }
@media (min-width: 900px) { header nav { flex-direction: column; } }
`;

/** A theme package that uses styles, a font, a PNG and a WebP, and fills two slots. `edit` changes the manifest or files before use. */
export async function modThemePackage(edit?: (input: { manifest: Record<string, any>; assets: Record<string, unknown> }) => void): Promise<ThemePackageInput> {
  const base = await fixtureThemePackage("bunzai.theme.modtest", "Mod test") as { manifest: Record<string, any>; assets: Record<string, unknown>; licenseText?: unknown };
  const m = base.manifest;
  m.assets.push({ id: "backdrop", path: "assets/backdrop.png", mediaType: "image/png" }, { id: "badge", path: "assets/badge.webp", mediaType: "image/webp" });
  base.assets["assets/backdrop.png"] = png();
  base.assets["assets/badge.webp"] = webp();
  m.fonts = [{ id: "face", path: "fonts/face.woff2", mediaType: "font/woff2" }];
  base.assets["fonts/face.woff2"] = woff2();
  m.styles = "styles.css";
  base.assets["styles.css"] = MOD_STYLES;
  m.slots = { "shell.nav.end": [{ kind: "image", asset: "badge", alt: "A small badge" }], "library.header": [{ kind: "text", text: "Opening night", class: "mod-stamp-note" }] };
  m.requests = [...new Set([...m.requests, "appearance.assets", "appearance.styles", "appearance.fonts", "ui.slots"])].sort();
  edit?.(base);
  return base;
}
