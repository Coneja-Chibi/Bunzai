/**
 * Settings store - atomic write; missing file = defaults; corrupt/unreadable throws.
 */
import type { StateStore } from "../stage/contracts/state-store";
import { isRecord } from "../core/guards";
import { StudioReadError } from "./errors";
import { parseSettings, type StudioSettings, DEFAULT_SETTINGS } from "./settings-shape";
import { stateDocument } from "./state-document-store";

/** A JSON object, strictly - settings treats any other shape (an array, a bare string, null) as
 *  corrupt, even though parseSettings itself would silently default it; see the file header. */
const strictSettings = (raw: unknown): StudioSettings => {
  if (!isRecord(raw)) throw new Error("not an object");
  return parseSettings(raw);
};

const corrupt = (): never => {
  throw new StudioReadError("corrupt settings file");
};

export class SettingsStore {
  private readonly doc;

  constructor(dir: string, stateFor?: () => StateStore | null) {
    this.doc = stateDocument(dir, "settings", { ...DEFAULT_SETTINGS }, strictSettings, corrupt, stateFor);
  }

  read(): Promise<StudioSettings> {
    return this.doc.read();
  }

  save(raw: unknown): Promise<StudioSettings> {
    if (!isRecord(raw)) return Promise.reject(new StudioReadError("invalid settings payload"));
    const settings = parseSettings(raw);
    return this.doc.enqueue(() => this.doc.write(settings));
  }

  update(raw: unknown): Promise<StudioSettings> {
    if (!isRecord(raw)) return Promise.reject(new StudioReadError("invalid settings patch"));
    return this.doc.enqueue(async () => {
      const current = await this.read();
      return this.doc.write(parseSettings({ ...current, ...raw }));
    });
  }
}
