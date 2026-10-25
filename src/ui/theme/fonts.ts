/**
 * The house fonts the app ships (src/ui/theme/fonts, each under the SIL Open Font License with its
 * OFL-<font>.txt beside it). The one list the server serves at /fonts/<file> and the packaged build
 * bakes; tokens.css declares them. A file not on this list is never served.
 */
export const FONT_FILES = [
  "archivo-latin-normal.woff2",
  "archivo-latin-ext-normal.woff2",
  "cinzel-latin-normal.woff2",
  "cinzel-latin-ext-normal.woff2",
  "fraunces-latin-normal.woff2",
  "fraunces-latin-ext-normal.woff2",
  "fraunces-latin-italic.woff2",
  "fraunces-latin-ext-italic.woff2",
  "atkinson-hyperlegible-latin-normal-400.woff2",
  "atkinson-hyperlegible-latin-ext-normal-400.woff2",
  "atkinson-hyperlegible-latin-normal-700.woff2",
  "atkinson-hyperlegible-latin-ext-normal-700.woff2",
  "ibm-plex-mono-latin-normal-500.woff2",
  "ibm-plex-mono-latin-ext-normal-500.woff2",
  "inter-latin-normal.woff2",
  "inter-latin-ext-normal.woff2",
  "fredoka-latin-normal.woff2",
  "fredoka-latin-ext-normal.woff2",
  "courier-prime-latin-normal-400.woff2",
  "courier-prime-latin-ext-normal-400.woff2",
  "courier-prime-latin-normal-700.woff2",
  "courier-prime-latin-ext-normal-700.woff2",
  "lexend-latin-normal.woff2",
  "opendyslexic-latin-normal-400.woff2",
  "crimson-pro-latin-normal.woff2",
  "playfair-display-latin-normal.woff2",
  "jetbrains-mono-latin-normal.woff2",
] as const;

export const isFontFile = (name: string): name is (typeof FONT_FILES)[number] => (FONT_FILES as readonly string[]).includes(name);
