/**
 * The check for how a generated swipe was made (RoleCall's SwipeData generation fields): plain
 * data only, every field its own type, an unknown field refused. Split from chat-rules.ts for the file-size cap.
 */
import { isPlainObject } from "../../core/guards";
import type { Generation } from "../contracts/chat-store";
import { checkWhole, fail, isWhole } from "./scalar-rules";

export function checkGeneration(value: unknown): Generation | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) fail("generation must be a plain object");
  const out: Record<string, unknown> = {};
  const known = new Set(["model", "finishReason", "promptTokens", "completionTokens", "generationMs", "reasoningMs", "tagThinkingMs", "presetName", "guidance", "samplers", "reasoning", "prefill", "thinkingEnd", "finalCut"]);
  for (const key of Object.keys(value)) if (!known.has(key)) fail(`generation has an unknown field: ${key}`);
  const text = (key: string, from: Record<string, unknown>, into: Record<string, unknown>) => {
    const v = from[key];
    if (v === undefined) return;
    if (typeof v !== "string") fail(`generation ${key} must be text`);
    into[key] = v;
  };
  const count = (key: string) => {
    const v = value[key];
    if (v === undefined) return;
    if (typeof v !== "number" || !Number.isFinite(v)) fail(`generation ${key} must be a finite number`);
    out[key] = v;
  };
  text("model", value, out);
  text("finishReason", value, out);
  count("promptTokens");
  count("completionTokens");
  for (const key of ["generationMs", "reasoningMs", "tagThinkingMs"]) count(key);
  text("presetName", value, out);
  text("guidance", value, out);
  text("prefill", value, out);
  if (value.thinkingEnd !== undefined) {
    out.thinkingEnd = checkWhole(value.thinkingEnd, "generation thinkingEnd must be a positive whole number", 1);
  }
  if (value.finalCut !== undefined) {
    const f = value.finalCut;
    const whole = (n: unknown): boolean => isWhole(n, 0, 1_000);
    if (!isPlainObject(f) || Object.keys(f).some((k) => k !== "passes" && k !== "changed" && k !== "failed") || !whole(f.passes) || !whole(f.failed) || typeof f.changed !== "boolean") fail("generation finalCut must be { passes, changed, failed }");
    out.finalCut = { passes: f.passes, changed: f.changed, failed: f.failed };
  }
  if (value.samplers !== undefined) {
    if (!isPlainObject(value.samplers)) fail("generation samplers must be a plain object");
    const samplers: Record<string, number | string | boolean> = {};
    for (const [k, v] of Object.entries(value.samplers)) {
      if (v === undefined) continue;
      const ok = typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));
      if (!ok) fail(`generation sampler ${k} must be a finite number, text, or true or false`);
      samplers[k] = v as number | string | boolean;
    }
    out.samplers = samplers;
  }
  if (value.reasoning !== undefined) {
    const r = value.reasoning;
    if (!isPlainObject(r)) fail("generation reasoning must be a plain object");
    for (const key of Object.keys(r)) if (!["text", "signature", "provider", "model"].includes(key)) fail(`generation reasoning has an unknown field: ${key}`);
    if (typeof r.text !== "string") fail("generation reasoning text must be text");
    const reasoning: Record<string, unknown> = {};
    for (const key of ["text", "signature", "provider", "model"]) text(key, r, reasoning);
    out.reasoning = reasoning;
  }
  return out as Generation;
}
