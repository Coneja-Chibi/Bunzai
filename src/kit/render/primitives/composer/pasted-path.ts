/**
 * Recognises file paths typed or pasted into the composer's draft.
 *
 * This boundary distinguishes paths in the person's draft from paths assembled by the model.
 *
 * A path written by the person can request access to that one file; a path assembled by the model
 * cannot. This only examines the composer's draft and returns file candidates, never folder grants.
 *
 * Pure and total: text in, candidates out. It touches no filesystem, so it cannot be the thing that
 * decides a path exists - the caller stats it, and a path that is not a real file simply never
 * becomes a grant.
 */
import { extensionOf } from "../../../../core/media/mime";

/**
 * Windows drive paths and POSIX absolute paths, quoted or bare.
 *
 * Quoted first, because a quoted path is unambiguous and may contain spaces. The bare forms stop at
 * whitespace, which is the honest limit: `C:\My Cards\dite.png` unquoted is indistinguishable from a
 * path followed by a sentence, and guessing where it ends would sometimes swallow the next word.
 */
const PATTERNS: readonly RegExp[] = [
  /"([a-zA-Z]:[\\/][^"\n]+|\/[^"\n]+)"/g,
  /'([a-zA-Z]:[\\/][^'\n]+|\/[^'\n]+)'/g,
  /(?<![\w"'])([a-zA-Z]:[\\/][^\s"'<>|]+)/g,
  // The `:` in the lookbehind matters: without it this pattern also matches the TAIL of a Windows
  // path written with forward slashes, so `C:/Users/me/preset.json` yielded a second, phantom
  // `/Users/me/preset.json` - a path that does not exist, offered as though it did.
  /(?<![\w"'/:])(\/(?:[^\s"'<>|/]+\/)+[^\s"'<>|/]+)/g,
];

/** Extensions Kit can actually do something with, for the FILE case. */
const KNOWN = new Set([
  ".json", ".png", ".yaml", ".yml", ".charx", ".card", ".webp", ".jpeg", ".jpg", ".txt", ".md", ".zip",
]);

/**
 * Minimum segments required to recognize a bare folder path.
 *
 * Folders have no extension, so this depth check excludes drive roots. The caller still stats each
 * candidate and reports what it opened; this count alone never grants access.
 */
const MIN_FOLDER_SEGMENTS = 3;

export interface PastedPath {
  /** The path exactly as it will be opened, quotes stripped. */
  readonly path: string;
  /** Where it sat in the draft, so a caller can show it or strip it. */
  readonly start: number;
  readonly end: number;
  /**
   * Longer readings of the same path, longest first, for an UNQUOTED path that may contain spaces.
   *
    * A path with spaces typed without quotes is ambiguous: it may
   * end at "OpenAI", or the next word may be part of it. Nothing in the text can settle that - but
   * the FILESYSTEM can. The caller stats these longest-first and takes the first that exists, which
    * is how a folder path resolves without requiring quotes.
   *
   * Bounded to a few words: a path is allowed to contain spaces, not to swallow the sentence.
   */
  readonly longer: readonly string[];
}

/** How many following words a bare path may absorb. A path may contain spaces, not eat a sentence. */
const MAX_EXTRA_WORDS = 4;

/**
 * The same path with 1..N following words appended, LONGEST FIRST.
 *
 * Longest first because the caller stats them in order and stops at the first that exists: given
 * `...\OpenAI Settings Can you copy` on disk as `...\OpenAI Settings`, trying short-to-long would
 * stop at `...\OpenAI` if that happened to exist too, and quietly grant the wrong folder.
 */
function longerReadings(draft: string, path: string, end: number): string[] {
  const rest = draft.slice(end);
  const words = rest.split(/\s+/).filter((w) => w !== "").slice(0, MAX_EXTRA_WORDS);
  const out: string[] = [];
  let acc = path;
  for (const word of words) {
    // A word carrying sentence punctuation ends the path: "Settings." is where somebody stopped.
    if (/[.,;:!?"']$/.test(word) && !/\.[a-zA-Z0-9]{1,5}$/.test(word)) break;
    acc = `${acc} ${word}`;
    out.push(acc);
  }
  return out.reverse();
}

/**
 * Every path in a draft, in the order they appear, de-duplicated.
 *
 * Recognizes files by extension and folders by depth. This allows a person to identify either kind
 * of path in the draft.
 *
 * So a file needs a known extension (an extension is what makes a file recognisable as one), and a
 * folder needs enough segments not to be a gesture at a drive root. Neither test is the real guard:
 * the CALLER stats the path, so nothing that does not exist becomes a grant, and it names what it
 * opened so a wrong one is visible and revocable rather than silent.
 */
export function pastedPaths(draft: string): PastedPath[] {
  const found: PastedPath[] = [];
  const seen = new Set<string>();
  for (const pattern of PATTERNS) {
    // Fresh lastIndex per call: these are module-level /g regexes, and a shared cursor would make
    // the second call over the same draft start halfway through and miss the first path.
    pattern.lastIndex = 0;
    for (const match of draft.matchAll(pattern)) {
      const raw = match[1];
      if (raw === undefined || match.index === undefined) continue;
      const path = raw.trim().replace(/[.,;:!?)\]]+$/, "");
      // Hidden final segments (.ssh, .config) have no recognized extension. They have
      // no extension to recognise, so without this check it would pass as a folder.
      if (/(?:^|[\\/])\.[^\\/.]*$/.test(path)) continue;
      const ext = extensionOf(path);
      const extension = ext === "" ? "" : `.${ext}`;
      const segments = path.split(/[\\/]+/).filter((part) => part !== "" && !/^[a-zA-Z]:$/.test(part));
      // An extension makes it a file; enough depth makes it a folder worth taking at their word.
      // An unknown extension is neither - `evil.dll` is a file Kit has no business opening.
      const looksLikeFile = extension !== "";
      const ok = looksLikeFile ? KNOWN.has(extension) : segments.length >= MIN_FOLDER_SEGMENTS;
      if (!ok) continue;
      const key = path.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const end = match.index + match[0].length;
      // Quoted paths already said where they end, so only a bare one needs the longer readings.
      const quoted = match[0].startsWith(`"`) || match[0].startsWith(`'`);
      found.push({ path, start: match.index, end, longer: quoted ? [] : longerReadings(draft, path, end) });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}
