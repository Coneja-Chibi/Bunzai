/**
 * BYAF ZIP container: open, pack, original twin encode/decode. No body mapping.
 */
import { zipSync, strToU8, strFromU8 } from "fflate";
import { unzipCard } from "../../core/archive";
import { base64ToBytes, bytesToBase64 } from "../../core/base64";
import { isRecord, optStr, type Rec } from "../../core/guards";
import { mimeFromPath } from "../../core/media/mime";
import { isZipBytes } from "../../core/bytes";

export { mimeFromPath };

export interface OpenedByaf {
  manifest: Rec;
  characterPath: string;
  characterDir: string;
  character: Rec;
  scenarios: { path: string; data: Rec }[];
  /** full zip paths -> bytes (for re-pack + images) */
  files: Record<string, Uint8Array>;
}

export function openByaf(bytes: Uint8Array): OpenedByaf | null {
  if (!isZipBytes(bytes)) return null;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipCard(bytes);
  } catch {
    return null;
  }
  const manBytes = files["manifest.json"];
  if (!manBytes) return null;
  let manifest: Rec;
  try {
    const m = JSON.parse(strFromU8(manBytes));
    if (!isRecord(m)) return null;
    manifest = m;
  } catch {
    return null;
  }
  const charList = Array.isArray(manifest.characters) ? manifest.characters : [];
  const characterPath = typeof charList[0] === "string" ? charList[0] : "";
  if (!characterPath || !files[characterPath]) return null;
  let character: Rec;
  try {
    const c = JSON.parse(strFromU8(files[characterPath]!));
    if (!isRecord(c)) return null;
    character = c;
  } catch {
    return null;
  }
  const slash = characterPath.lastIndexOf("/");
  const characterDir = slash >= 0 ? characterPath.slice(0, slash + 1) : "";

  const scenList = Array.isArray(manifest.scenarios) ? manifest.scenarios : [];
  const scenarios: { path: string; data: Rec }[] = [];
  for (const p of scenList) {
    if (typeof p !== "string" || !files[p]) continue;
    try {
      const d = JSON.parse(strFromU8(files[p]!));
      if (isRecord(d)) scenarios.push({ path: p, data: d });
    } catch {
      /* skip bad scenario */
    }
  }
  return { manifest, characterPath, characterDir, character, scenarios, files };
}

/** Persist archive twin as JSON-safe original (files as base64). */
export function archiveToOriginal(arc: OpenedByaf): Rec {
  const files: Rec = {};
  for (const [k, v] of Object.entries(arc.files)) {
    files[k] = bytesToBase64(v);
  }
  return {
    manifest: arc.manifest,
    characterPath: arc.characterPath,
    characterDir: arc.characterDir,
    character: arc.character,
    scenarios: arc.scenarios,
    files,
  };
}

export function originalToArchive(raw: unknown): OpenedByaf | null {
  if (!isRecord(raw)) return null;
  const characterPath = optStr(raw.characterPath);
  const characterDir = optStr(raw.characterDir) ?? "";
  if (!characterPath || !isRecord(raw.character) || !isRecord(raw.manifest)) return null;
  const filesIn = isRecord(raw.files) ? raw.files : {};
  const files: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(filesIn)) {
    if (typeof v === "string") files[k] = base64ToBytes(v);
  }
  const scenariosRaw = Array.isArray(raw.scenarios) ? raw.scenarios : [];
  const scenarios: { path: string; data: Rec }[] = [];
  for (const row of scenariosRaw) {
    if (!isRecord(row)) continue;
    const path = optStr(row.path);
    if (!path || !isRecord(row.data)) continue;
    scenarios.push({ path, data: row.data });
  }
  return {
    manifest: raw.manifest,
    characterPath,
    characterDir,
    character: raw.character,
    scenarios,
    files,
  };
}

export function packByaf(arc: OpenedByaf): Uint8Array {
  arc.files["manifest.json"] = strToU8(JSON.stringify(arc.manifest, null, 2));
  arc.files[arc.characterPath] = strToU8(JSON.stringify(arc.character, null, 2));
  for (const sc of arc.scenarios) {
    arc.files[sc.path] = strToU8(JSON.stringify(sc.data, null, 2));
  }
  const out: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(arc.files)) {
    if (k.endsWith("/")) continue;
    out[k] = v;
  }
  return zipSync(out);
}

/** Detect-only: load manifest.json entry if present. */
export function readManifestBytes(zipBytes: Uint8Array): Uint8Array | undefined {
  try {
    return unzipCard(zipBytes, "manifest.json")["manifest.json"];
  } catch {
    return undefined;
  }
}
