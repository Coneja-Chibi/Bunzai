/**
 * Writing a Sprite pack as a ZIP of its pictures. Pure and incremental: entry names are decided up front
 * (so they cannot collide), then the archive is produced one picture at a time, each stored without
 * compression (a png, jpg or webp is already compressed), so the writer holds one picture, never the pack.
 * `core/media/zip-import.ts` is the reading half; the image-pack codec and the Press share this half.
 */
import { Zip, ZipPassThrough } from "fflate";
import { sanitizeDownloadBase } from "../download-name";
import { extFromMime } from "./mime";

export interface PackPictureName {
  label: string;
  mime: string;
}

/** A label as a file stem: the shared download-name rule (path characters, Windows device names, length), leading dots and spaces dropped first. */
const stemOf = (label: string): string => sanitizeDownloadBase(label.replace(/^[\s.]+/, ""), "picture");

/**
 * One entry name per picture, `<label>.<ext>`: path characters become "-", and a name another picture
 * already has (compared case-insensitively, as Windows and macOS extract) becomes `<label> (2).<ext>` and so
 * on. No picture is ever left out or overwritten by another.
 */
export function packEntryNames(pictures: readonly PackPictureName[]): string[] {
  const taken = new Set<string>();
  return pictures.map(({ label, mime }) => {
    const ext = extFromMime(mime) ?? "bin";
    const stem = stemOf(label);
    let name = `${stem}.${ext}`;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${stem} (${n}).${ext}`;
    taken.add(name.toLowerCase());
    return name;
  });
}

export interface PackZipEntry {
  name: string;
  /** Called when this entry's turn comes, so only one picture is in memory at a time. */
  bytes(): Promise<Uint8Array>;
}

/** The ZIP of `entries`, yielded in chunks as each picture is written. Rejects, rather than ending short, when a picture cannot be read. */
export async function* zipStored(entries: Iterable<PackZipEntry>): AsyncGenerator<Uint8Array> {
  const ready: Uint8Array[] = [];
  let failure: unknown;
  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else ready.push(chunk);
  });
  for (const entry of entries) {
    const file = new ZipPassThrough(entry.name);
    zip.add(file);
    file.push(await entry.bytes(), true);
    if (failure) throw failure;
    yield* ready.splice(0);
  }
  zip.end();
  if (failure) throw failure;
  yield* ready.splice(0);
}
