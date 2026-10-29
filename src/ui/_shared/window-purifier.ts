/**
 * A DOMPurify bound to the window that is here NOW rather than the one that was here at import.
 *
 * `import DOMPurify from "dompurify"` binds to whatever `window` existed when the module first loaded. In a browser that is the
 * only window there will ever be; in this repo's suite it is whichever test file imported the module first, and once that file
 * closes its JSDOM (or when none was installed yet) every later caller has a sanitizer bound to nothing. Callers that sanitize
 * with plain options share this one; render-markup.ts keeps its own instance because it registers hooks on it.
 *
 * NO WINDOW IS A REFUSAL, not a pass-through: DOMPurify's unsupported build returns its input unchanged, so a caller without a DOM
 * would get untouched untrusted markup while claiming it was sanitized.
 */
import createDOMPurify from "dompurify";

let purifier: ReturnType<typeof createDOMPurify> | null = null;
let boundTo: unknown = null;

/** The sanitizer for the current window; `who` names the caller in the error when there is none. */
export function windowPurifier(who: string): ReturnType<typeof createDOMPurify> {
  const view = (globalThis as { window?: unknown }).window;
  if (view === undefined || view === null) throw new Error(`${who}: cannot sanitize without a DOM`);
  if (!purifier || boundTo !== view) {
    purifier = createDOMPurify(view as Parameters<typeof createDOMPurify>[0]);
    boundTo = view;
  }
  return purifier;
}
