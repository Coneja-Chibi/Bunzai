/**
 * Reading a file in the studio folder that is not one of ours.
 *
 * WHY IT LIVES AT THE ROOT. Detection is registered at the app layer, so `src/studio` cannot import
 * it without inverting the dependency that folder is arranged around - its own header says so. But
 * BOTH app layers need it, and while this function lived inside Kit's bridge only Kit had it. The
 * desktop window built its store without one and reported 145 readable presets as damage: the ones
 * whose names hold a space or an ampersand as `unusable-filename`, the rest as `schema-mismatch`.
 * Neither was true. They were SillyTavern exports, sitting where somebody's presets go.
 *
 * Here, one layer below both, it is the thing you get by default rather than the thing you have to
 * remember - see `openStudio` at the bottom of this file.
 */
import { detect } from "./core/registry";
import { readingsOf } from "./formats/_shared/repair-json";
import { toAdapterInput } from "./core/adapter-input";
import { ensureFormats } from "./ensure-formats";
import { StudioStore } from "./studio/store";
import type { ForeignPiece } from "./studio/foreign";

/**
 * Detect and convert one file, or null when nothing recognises it.
 *
 * TOTAL: never throws. A file nothing recognises, a file that recognises and then fails to convert,
 * and a file that is not really JSON are all the same answer here - null - because the caller is
 * building an inventory and one bad file may not take the folder down with it.
 */
export async function readForeignFile(
  bytes: Uint8Array,
  filename: string,
  kind: string,
): Promise<ForeignPiece | null> {
  try {
    /**
     * REGISTER FIRST. The codec graph loads lazily - a static import would pull every adapter into
     * Kit's cold start for work most sessions never do - so at listing time the registry is empty
     * and detect() answers undefined for everything. ensureFormats is idempotent and cached, so this
     * costs one load the first time a non-canonical file is met and nothing afterwards.
     */
    await ensureFormats();
    const input = toAdapterInput(bytes, filename);
    let adapter = detect(input);
    let reading = input;

    /**
     * NOTHING RECOGNISED IT: try the readings that repair a shape rather than a format.
     *
     * A real studio had seven files behind "not in a format Bunraku recognises" and five held a
     * preset - four encoded as JSON twice over, one inside an export envelope. The bytes were fine;
     * the container was not. See repair-json.ts.
     *
     * Only reached when the plain reading failed, so a healthy file never meets any of this.
     */
    if (!adapter) {
      const text = new TextDecoder().decode(bytes);
      let parsed: unknown = null;
      try { parsed = JSON.parse(text) as unknown; } catch { parsed = null; }
      for (const candidate of parsed === null ? [] : readingsOf(parsed).slice(1)) {
        const repaired = toAdapterInput(
          new TextEncoder().encode(JSON.stringify(candidate)),
          filename,
        );
        const found = detect(repaired);
        if (found && found.kind === kind) { adapter = found; reading = repaired; break; }
      }
    }
    /**
     * The adapter has to agree about the KIND. A character card sitting in the preset folder is not
     * a preset, and listing it as one would put a piece in a deck that cannot open it.
     */
    if (!adapter || adapter.kind !== kind) return null;
    const entity = adapter.toCanonical(reading) as { kind: string; body: unknown; id?: string };
    return entity?.kind ? { entity, format: adapter.id } : null;
  } catch {
    return null;
  }
}

/**
 * Open the studio at `dir`: the Studio's view of the library open for that folder. Files in another
 * platform's format are read by the folder import (src/studio/folder-import.ts), which is where
 * `readForeignFile` is used now; the library itself holds only canonical pieces.
 */
export function openStudio(dir: string): StudioStore {
  return new StudioStore(dir);
}
