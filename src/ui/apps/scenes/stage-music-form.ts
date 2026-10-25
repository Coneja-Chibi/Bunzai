/** The Music tab's small pure rules: which chosen files are sounds, and the words for a refused rename or removal. */
const SOUND_NAME = /\.(mp3|ogg|m4a|wav|flac|aac)$/i;

/** A file the pack can take as a track: its type says audio, or (when the browser leaves the type blank) its name does. */
export const soundFile = (file: { name: string; type: string }): boolean => file.type.startsWith("audio/") || (file.type === "" && SOUND_NAME.test(file.name));

/** The pack refuses two tracks with one title; say so in a person's words, and pass any other reason through. */
export function failureWords(reason: string): string {
  return /duplicate or empty/.test(reason) ? "Another track in this pack already has that title." : reason || "Could not save that.";
}
