/**
 * The input check and the merge for a scene's guides and scene note,
 * applied by every ChatStore implementation so they cannot refuse or keep different things.
 */
import type { ChatNote, ChatPrompting, ChatPromptingPatch, ChatReasoningEffort } from "../contracts/chat-store";
import { checkIdList, checkText, fail } from "./chat-rules";
import { isWhole } from "./scalar-rules";
import { isPlainObject } from "../../core/guards";
import { BUILTIN_CAPTURE_OPTIONS, CAPTURE_MAX_CUSTOM, CAPTURE_MAX_LENGTH, type ReasoningCapture } from "../../core/reasoning-capture";
import { NOTE_DEPTH_MAX, NOTE_FREQUENCY_MAX, NOTE_MAX } from "../../core/assembly/note";
import { TOOL_ROUNDS_MAX, TOOL_ROUNDS_MIN } from "../../core/assembly/tool-rounds";

const MAX_GUIDES = 50;
const MAX_TOOLS = 20;
export const GUIDE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function checkNote(value: unknown): ChatNote {
  if (!isPlainObject(value)) fail("note must be a plain object or null");
  for (const key of Object.keys(value)) if (!["text", "position", "depth", "frequency"].includes(key)) fail(`note has an unknown field: ${key}`);
  const text = checkText(value.text, "note text");
  if (text.length > NOTE_MAX) fail(`note text must be at most ${NOTE_MAX} characters`);
  if (value.position !== "after_scenario" && value.position !== "in_chat") fail("note position must be after_scenario or in_chat");
  if (!isWhole(value.depth, 0, NOTE_DEPTH_MAX)) fail(`note depth must be a whole number from 0 to ${NOTE_DEPTH_MAX}`);
  if (!isWhole(value.frequency, 0, NOTE_FREQUENCY_MAX)) fail(`note frequency must be a whole number from 0 to ${NOTE_FREQUENCY_MAX}`);
  return { text, position: value.position, depth: value.depth, frequency: value.frequency };
}

function checkGuides(value: unknown): string[] {
  if (!Array.isArray(value)) fail("guides must be a list or null");
  if (value.length > MAX_GUIDES) fail(`guides must be at most ${MAX_GUIDES}`);
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || !GUIDE_ID.test(id)) fail("a guide id must be 1 to 64 characters of letters, digits, - and _");
    if (seen.has(id)) fail(`guide ${id} is given twice`);
    seen.add(id);
  }
  return [...value];
}

function checkSwitch(value: unknown, what: string): boolean {
  if (typeof value !== "boolean") fail(`${what} must be true, false or null`);
  return value;
}

function checkRounds(value: unknown): number {
  if (!isWhole(value, TOOL_ROUNDS_MIN, TOOL_ROUNDS_MAX)) fail(`toolRounds must be a whole number from ${TOOL_ROUNDS_MIN} to ${TOOL_ROUNDS_MAX}`);
  return value;
}

export const EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh"];
const PREFILL_MAX = 2_000;

function checkEffort(value: unknown): ChatReasoningEffort {
  if (typeof value !== "string" || !EFFORTS.includes(value)) fail(`reasoningEffort must be one of ${EFFORTS.join(", ")} or null`);
  return value as ChatReasoningEffort;
}

function checkPrefill(value: unknown): string {
  const text = checkText(value, "prefill");
  if (text.length > PREFILL_MAX) fail(`prefill must be at most ${PREFILL_MAX} characters`);
  return text;
}

function checkRole(value: unknown): "user" | "system" {
  if (value !== "user" && value !== "system") fail("prefillRole must be user, system or null");
  return value;
}

/** Catch thinking (RoleCall): a known mode with its own-text rows (at most 10, each text at most 64 characters, blank while being typed) and its built-in picks. */
function checkCapture(value: unknown): ReasoningCapture {
  if (!isPlainObject(value)) fail("capture must be a plain object or null");
  for (const key of Object.keys(value)) if (!["mode", "custom", "builtinTags"].includes(key)) fail(`capture has an unknown field: ${key}`);
  if (value.mode !== "auto" && value.mode !== "only" && value.mode !== "off") fail("capture mode must be auto, only or off");
  if (!Array.isArray(value.custom) || value.custom.length > CAPTURE_MAX_CUSTOM) fail(`capture custom must be a list of at most ${CAPTURE_MAX_CUSTOM}`);
  const custom = value.custom.map((row: unknown) => {
    if (!isPlainObject(row) || typeof row.open !== "string" || typeof row.close !== "string" || row.open.length > CAPTURE_MAX_LENGTH || row.close.length > CAPTURE_MAX_LENGTH) fail(`a capture row needs an open and a close text of at most ${CAPTURE_MAX_LENGTH} characters`);
    return { open: row.open, close: row.close };
  });
  if (!Array.isArray(value.builtinTags) || value.builtinTags.some((t: unknown) => typeof t !== "string" || !BUILTIN_CAPTURE_OPTIONS.includes(t))) fail("capture builtinTags must be built-in thinking tags");
  return { mode: value.mode, custom, builtinTags: [...new Set(value.builtinTags as string[])] };
}

const KEYS = ["guides", "tools", "note", "lastAsUser", "toolAccess", "toolRounds", "reasoningEffort", "prefill", "prefillRole", "capture", "keepThinking", "continuity", "showPrefill"];

/** A patch whose keys are `guides`, `note`, `lastAsUser` and `toolAccess` (booleans) and `toolRounds`, each a valid value or null (rule 37). An empty patch is allowed and changes nothing. */
export function checkPrompting(value: unknown): ChatPromptingPatch {
  if (!isPlainObject(value)) fail("prompting must be a plain object");
  for (const key of Object.keys(value)) if (!KEYS.includes(key)) fail(`prompting has an unknown field: ${key}`);
  return {
    ...(value.guides === undefined ? {} : { guides: value.guides === null ? null : checkGuides(value.guides) }),
    ...(value.tools === undefined ? {} : { tools: value.tools === null ? null : checkIdList(value.tools, "tools", MAX_TOOLS) }),
    ...(value.note === undefined ? {} : { note: value.note === null ? null : checkNote(value.note) }),
    ...(value.lastAsUser === undefined ? {} : { lastAsUser: value.lastAsUser === null ? null : checkSwitch(value.lastAsUser, "lastAsUser") }),
    ...(value.toolAccess === undefined ? {} : { toolAccess: value.toolAccess === null ? null : checkSwitch(value.toolAccess, "toolAccess") }),
    ...(value.toolRounds === undefined ? {} : { toolRounds: value.toolRounds === null ? null : checkRounds(value.toolRounds) }),
    ...(value.reasoningEffort === undefined ? {} : { reasoningEffort: value.reasoningEffort === null ? null : checkEffort(value.reasoningEffort) }),
    ...(value.prefill === undefined ? {} : { prefill: value.prefill === null ? null : checkPrefill(value.prefill) }),
    ...(value.prefillRole === undefined ? {} : { prefillRole: value.prefillRole === null ? null : checkRole(value.prefillRole) }),
    ...(value.capture === undefined ? {} : { capture: value.capture === null ? null : checkCapture(value.capture) }),
    ...(value.keepThinking === undefined ? {} : { keepThinking: value.keepThinking === null ? null : checkSwitch(value.keepThinking, "keepThinking") }),
    ...(value.continuity === undefined ? {} : { continuity: value.continuity === null ? null : checkSwitch(value.continuity, "continuity") }),
    ...(value.showPrefill === undefined ? {} : { showPrefill: value.showPrefill === null ? null : checkSwitch(value.showPrefill, "showPrefill") }),
  };
}

/** The scene's prompting after a checked patch; null when nothing is left to keep. */
export function mergePrompting(old: ChatPrompting | undefined, patch: ChatPromptingPatch): ChatPrompting | null {
  const guides = patch.guides === undefined ? old?.guides : patch.guides ?? undefined;
  const toolsIn = patch.tools === undefined ? old?.tools : patch.tools ?? undefined;
  const tools = toolsIn?.length ? toolsIn : undefined;
  const note = patch.note === undefined ? old?.note : patch.note ?? undefined;
  const lastAsUser = patch.lastAsUser === undefined ? old?.lastAsUser : patch.lastAsUser ?? undefined;
  const toolAccess = patch.toolAccess === undefined ? old?.toolAccess : patch.toolAccess ?? undefined;
  const toolRounds = patch.toolRounds === undefined ? old?.toolRounds : patch.toolRounds ?? undefined;
  const reasoningEffort = patch.reasoningEffort === undefined ? old?.reasoningEffort : patch.reasoningEffort ?? undefined;
  const prefillIn = patch.prefill === undefined ? old?.prefill : patch.prefill ?? undefined;
  const prefill = prefillIn?.trim() ? prefillIn : undefined;
  const prefillRole = patch.prefillRole === undefined ? old?.prefillRole : patch.prefillRole ?? undefined;
  const captureIn = patch.capture === undefined ? old?.capture : patch.capture ?? undefined;
  // Auto with nothing picked is the default, so it is not kept.
  const capture = captureIn && (captureIn.mode !== "auto" || captureIn.custom.length > 0 || captureIn.builtinTags.length > 0) ? captureIn : undefined;
  const flag = (key: "keepThinking" | "continuity" | "showPrefill") => ((patch[key] === undefined ? old?.[key] : patch[key] ?? undefined) ? { [key]: true } : {});
  const next: ChatPrompting = {
    ...flag("keepThinking"), ...flag("continuity"), ...flag("showPrefill"),
    ...(guides ? { guides } : {}), ...(tools ? { tools } : {}), ...(note ? { note } : {}), ...(lastAsUser ? { lastAsUser } : {}), ...(toolAccess ? { toolAccess } : {}), ...(toolRounds !== undefined ? { toolRounds } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}), ...(prefill ? { prefill } : {}), ...(prefillRole ? { prefillRole } : {}), ...(capture ? { capture } : {}),
  };
  return Object.keys(next).length > 0 ? next : null;
}
