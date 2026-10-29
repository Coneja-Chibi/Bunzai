/**
 * Runtime-neutral Studio engine actions shared by the loopback server and browser-only build.
 * They own format inspection/export semantics, but know nothing about HTTP or filesystems.
 */
import { characterPngCard, pngCardRefusal } from "../formats/_shared/card-png";
import { toErrorMessage } from "./_shared/error-message";
import { buildParseReport, buildSerializeReport } from "../core/reports";
import * as registry from "../core/registry";
import { toAdapterInput } from "../core/adapter-input";
import { isArchiveLimitError } from "../core/archive";
import type { AdapterInput, AdapterOutput, FormatAdapter } from "../core/adapter";
import { carriesEmbedded, emitPieces, readPieces, withUnattached } from "../convert";
import { resolveLinks } from "../core/links";
import type { CanonicalCharacter } from "../entities/character/schema";
import {
  parseCanonicalEntity,
  safeParseCanonicalEntity,
  type ParsedCanonicalEntity,
} from "../entities/runtime-schema";
import type { StudioStoreLike } from "../studio/contracts";
import { isLibraryLocked, isStudioReadError } from "../studio/errors";
import type { ExportResult, InspectResult } from "./app-contract";
import { CHAT_FORMAT_ID, looksLikeChat, readChat } from "../formats/sillytavern/chat";
import { SceneRefusal } from "../core/scene-import";
import { buildReceipt, buildSceneReceipt, friendlyFormat, UNKNOWN_FILE_MESSAGE, unsupportedShapeLine } from "./receipt";
import { forFormatKind } from "../core/writing";

type AnyEntity = ParsedCanonicalEntity;

export class EngineActionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "EngineActionError";
  }
}

export const formatMeta = (adapter: FormatAdapter): Record<string, unknown> => ({
  id: adapter.id,
  label: adapter.label,
  kind: adapter.kind,
  outputExtensions: adapter.outputExtensions,
  friendly: friendlyFormat(adapter.id),
  native: adapter.native ?? false,
  generic: adapter.generic ?? false,
});

/**
 * A `.jsonl` is a chat log, read by the chat codec directly because it is not an adapter in the registry
 * (a scene is not a library piece; see formats/sillytavern/chat.ts). The result carries the scene
 * carrier in `entity`, so the sheet and the save routes handle it like any other row.
 */
function inspectChat(input: AdapterInput): InspectResult {
  if (!looksLikeChat(input)) return { ok: false, error: "This .jsonl file is not a SillyTavern chat log: its first line is neither a chat header nor a message." };
  try {
    const scene = readChat(input.text!, input.filename ?? "chat.jsonl");
    return { ok: true, receipt: buildSceneReceipt(scene, CHAT_FORMAT_ID), entity: scene, formatId: CHAT_FORMAT_ID, kind: scene.kind };
  } catch (error) {
    return { ok: false, error: error instanceof SceneRefusal ? error.message : "This looks like a SillyTavern chat, but it is damaged and we could not read it safely." };
  }
}

export function inspectBytes(bytes: Uint8Array, filename: string): InspectResult {
  if (bytes.length === 0) throw new EngineActionError("empty upload");
  const input = toAdapterInput(bytes, filename);
  if (/.jsonl$/i.test(filename)) return inspectChat(input);
  const adapter = registry.detect(input);
  if (!adapter) return { ok: false, error: unsupportedShapeLine(input.text) ?? UNKNOWN_FILE_MESSAGE };
  try {
    const { entity, related } = readPieces(adapter, input);
    return {
      ok: true,
      receipt: buildReceipt(entity, adapter.id, related),
      entity,
      ...(related.length > 0 ? { related } : {}),
      formatId: adapter.id,
      kind: entity.kind,
      parseReport: buildParseReport(entity, adapter.id),
    };
  } catch (error) {
    // A file over a size or count budget is not a damaged file; say which it is.
    if (isArchiveLimitError(error)) {
      return { ok: false, error: error.plain ? error.message : `This ${friendlyFormat(adapter.id)} file is larger or more complex than Bunzai can safely read.` };
    }
    return {
      ok: false,
      error: `This looks like a ${friendlyFormat(adapter.id)} file, but it is damaged and we could not read it safely.`,
    };
  }
}

/** The pieces an entity's file carries inside it (its embedded links), read from the studio; a read that fails counts as gone. */
function linkedPieces(store: StudioStoreLike, entity: AnyEntity): ReturnType<typeof resolveLinks<ParsedCanonicalEntity>> {
  return resolveLinks<ParsedCanonicalEntity>(entity.kind, entity.body, async (kind, id) => {
    try {
      const found = await store.read(kind, id);
      return found && found.kind === kind ? (found as ParsedCanonicalEntity) : null;
    } catch (error) {
      if (!isStudioReadError(error)) throw error;
      return null;
    }
  }, "embedded");
}

/**
 * Write a piece with the linked pieces its own file carries (embedded links: a card's lorebooks, a preset's regex sets;
 * convert.ts emitPieces). A person exporting here can fix a broken link, so an embedded link that points at a piece no
 * longer in the library refuses the export by name (fail closed; Kit's export reports and carries on instead, its own
 * choice). Links the file never carries are not read. What the target cannot carry is a warning.
 */
async function writeLinked(store: StudioStoreLike, target: FormatAdapter, entity: ParsedCanonicalEntity, extension?: string): Promise<AdapterOutput> {
  const { found, missing } = await linkedPieces(store, entity);
  // a target that never carries the embedded pieces cannot lose a missing one; the found ones still warn below
  if (missing.length > 0 && carriesEmbedded(target)) throw new EngineActionError(`missing linked pieces: ${missing.map((m) => `${m.kind} "${m.id}"`).join(", ")}`, 422);
  const { output, unattached } = emitPieces(target, entity, found.map((f) => f.entity), extension);
  return withUnattached(output, unattached);
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

export async function exportCanonical(store: StudioStoreLike, body: unknown): Promise<ExportResult> {
  const request = body as { entity?: unknown; targetId?: unknown; extension?: unknown } | null;
  if (!request?.entity || typeof request.targetId !== "string") {
    throw new EngineActionError("expected { entity, targetId }");
  }
  const parsed = safeParseCanonicalEntity(request.entity);
  if (!parsed.ok) {
    throw new EngineActionError(`invalid canonical entity: ${parsed.issues[0] ?? "invalid shape"}`);
  }
  const target = registry.get(request.targetId);
  if (!target) throw new EngineActionError(`unknown format "${request.targetId}"`);
  // a writing setup is written by a preset format as the preset it sends (core/writing.ts)
  const entity = forFormatKind(parsed.entity, target.kind) as ParsedCanonicalEntity;
  if (entity.kind !== target.kind) {
    throw new EngineActionError(`cannot write a ${entity.kind} as ${target.id} (a ${target.kind} format)`);
  }
  try {
    let out: AdapterOutput;
    if (target.kind === "character" && entity.kind === "character") {
      const wanted = typeof request.extension === "string" ? request.extension.toLowerCase() : undefined;
      const character = entity as CanonicalCharacter;
      const writesPng = target.outputExtensions.some((extension) => extension.replace(/^\./, "") === "png");
      if (wanted === "png" && !writesPng) {
        const refusal = pngCardRefusal(character);
        if (refusal) throw new EngineActionError(`${target.id}: ${refusal}`, 422);
        out = {
          bytes: characterPngCard(character),
          suggestedExtension: "png",
          report: buildSerializeReport(entity, target),
        };
      } else {
        out = await writeLinked(store, target, entity, wanted);
      }
    } else {
      out = await writeLinked(store, target, entity);
    }
    return {
      suggestedExtension: out.suggestedExtension,
      text: out.text,
      bytesB64: out.bytes ? bytesToBase64(out.bytes) : undefined,
      report: out.report ?? buildSerializeReport(entity, target),
    };
  } catch (error) {
    if (error instanceof EngineActionError || isLibraryLocked(error)) throw error;
    throw new EngineActionError(`${target.id}: ${toErrorMessage(error)}`, 422);
  }
}
