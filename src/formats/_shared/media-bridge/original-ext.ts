/** Read and clone the parsed `original.<format>.raw.data.extensions` path for media bridges. */
import { isRecord, type Rec } from "../../../core/guards";

export function readOriginalExt(original: Record<string, unknown>, format: string): Rec | null {
  const host = original[format];
  const raw = isRecord(host) && isRecord(host.raw) ? host.raw : null;
  const data = raw && isRecord(raw.data) ? raw.data : null;
  return data && isRecord(data.extensions) ? data.extensions : null;
}

export function writeOriginalExt(
  original: Record<string, unknown>,
  format: string,
  fields: Rec,
  namespace?: string,
): Record<string, unknown> {
  const host: Rec = isRecord(original[format]) ? { ...original[format] } : {};
  const raw: Rec = isRecord(host.raw) ? { ...host.raw } : {};
  const data: Rec = isRecord(raw.data) ? { ...raw.data } : {};
  const extensions: Rec = isRecord(data.extensions) ? { ...data.extensions } : {};
  if (namespace) {
    const nested: Rec = isRecord(extensions[namespace]) ? { ...extensions[namespace] } : {};
    extensions[namespace] = { ...nested, ...fields };
  } else {
    Object.assign(extensions, fields);
  }
  data.extensions = extensions;
  raw.data = data;
  host.raw = raw;
  return { ...original, [format]: host };
}
