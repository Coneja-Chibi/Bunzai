/**
 * Builds the two S0 streaming-probe fixtures from a folder of real pictures: a picture zip (stored)
 * and a realistic .lvbak (characters with avatars, gallery images, a world book, a preset).
 * Read-only on the source folder; writes only into the output folder (an empty OS-temp child).
 *   bun scripts/scale/stream-probe-fixtures.ts <pictures-folder> <output-folder>
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { zipSync } from "fflate";
import { assembleLvbak, lvbakManifest, lvbakStats } from "../../src/formats/_fixtures/lumiverse-archive/build-lvbak";
import {
  characterRow, galleryRow, imageRow, presetRow, worldBookEntryRow, worldBookRow, type LvbakRow,
} from "../../src/formats/_fixtures/lumiverse-archive/rows";

const [source, out] = process.argv.slice(2);
if (!source || !out) throw new Error("usage: stream-probe-fixtures.ts <pictures-folder> <output-folder>");
mkdirSync(out, { recursive: true });
const names = readdirSync(source).filter((n) => /\.(jpe?g|png|webp)$/i.test(n)).sort();
const bytes = new Map(names.map((n) => [n, new Uint8Array(readFileSync(join(source, n)))]));

// Picture zip: stored, flat, original names.
writeFileSync(join(out, "pictures.zip"), zipSync(Object.fromEntries(names.map((n) => [n, [bytes.get(n)!, { level: 0 }]]))));

// .lvbak: every picture is a character avatar (copy A) and a gallery image (copy B, own file name).
const files: Record<string, Uint8Array> = {};
const characters: LvbakRow[] = [];
const images: LvbakRow[] = [];
const gallery: LvbakRow[] = [];
names.forEach((n, i) => {
  const avatar = `avatar-${i}${extname(n).toLowerCase()}`;
  const gal = `gallery-${i}${extname(n).toLowerCase()}`;
  files[`files/avatars/${avatar}`] = bytes.get(n)!;
  files[`files/images/${gal}`] = bytes.get(n)!;
  const id = `lv-char-${String(i).padStart(12, "0")}`;
  const imageId = `lv-image-${String(i).padStart(12, "0")}`;
  characters.push(characterRow({ id, name: `Probe Character ${i}`, avatar_path: avatar, image_id: null }));
  images.push(imageRow({ id: imageId, filename: gal, character_id: id, mime_type: /png$/i.test(n) ? "image/png" : "image/jpeg" }));
  gallery.push(galleryRow({ id: `lv-gallery-${String(i).padStart(12, "0")}`, character_id: id, image_id: imageId, sort_order: 0 }));
});
const tables: Record<string, LvbakRow[]> = {
  characters, images, character_gallery: gallery,
  world_books: [worldBookRow()], world_book_entries: [worldBookEntryRow()], presets: [presetRow()],
};
writeFileSync(join(out, "probe.lvbak"), assembleLvbak({ manifest: lvbakManifest(), tables, files, stats: lvbakStats(tables) }));
console.log(`pictures: ${names.length}, bytes ${[...bytes.values()].reduce((a, b) => a + b.length, 0)}`);
