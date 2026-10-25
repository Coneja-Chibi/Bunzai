/**
 * Which files of a zip or a dropped folder are pictures of a Sprite pack. One extension set and one junk
 * rule, so the zip reader, the image-pack codec and the folder dropper cannot disagree about a file
 * (a pack the dropper accepts must be one the reader opens). Names may carry a path; only the last
 * segment is the file.
 */
import { extensionOf } from "./mime";

/** The picture types a pack import accepts; narrower than the shared image catalog on purpose (proven subset). */
export const PACK_PICTURE_EXTENSIONS: ReadonlySet<string> = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

/** The sound types a pack takes (a Mood Music track); the same set the asset door sniffs and the Press writes. */
export const PACK_SOUND_EXTENSIONS: ReadonlySet<string> = new Set(["mp3", "ogg", "m4a", "wav", "flac", "aac"]);

const lastSegment = (path: string): string => path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);

/** A folder marker, anything under __MACOSX, a hidden file (".DS_Store", "._x.png") or Thumbs.db: archiver litter, never content. */
export function isPackPictureJunk(path: string): boolean {
  if (path.endsWith("/") || path.endsWith("\\")) return true;
  if (path.split(/[\\/]/).includes("__MACOSX")) return true;
  const base = lastSegment(path);
  return base.startsWith(".") || base.toLowerCase() === "thumbs.db";
}

/** A real picture file of a pack: a supported picture extension and not junk. */
export function isPackPictureName(path: string): boolean {
  return !isPackPictureJunk(path) && PACK_PICTURE_EXTENSIONS.has(extensionOf(path));
}

/** A real sound file of a pack: a supported sound extension and not junk. */
export function isPackSoundName(path: string): boolean {
  return !isPackPictureJunk(path) && PACK_SOUND_EXTENSIONS.has(extensionOf(path));
}

/** A real file of a pack, picture or sound. */
export const isPackMediaName = (path: string): boolean => isPackPictureName(path) || isPackSoundName(path);
