/**
 * A library tool as the model meets it: its function schema and its strict argument reader both come from the one field list, and
 * calling it runs one first-party action (a tool carries no code). Roll rolls the dice the model writes, dice rolls a library dice
 * piece (core/dice-piece.ts), both on the caller's randomness so the same seed rolls the same; formula runs a library formula on a copy
 * of the turn's macro context (core/formula.ts); record only records the call. All are read-only: none changes the scene or the library.
 */
import type { ToolBody, ToolField } from "../entities/tool/schema";
import { isRecord } from "./guards";
import type { DiceBody } from "../entities/dice/schema";
import { boundedDice, DICE_RULE, rollDice, rollSummary } from "./dice";
import { rollDicePiece } from "./dice-piece";
import { runFormulaReadOnly } from "./formula";
import type { MacroContext, MacroDeadline } from "./macros";

/** What a tool's action links, read by the caller: the dice piece, or the formula's text and the turn's macro context once it exists. */
export interface ToolLinks { dice?: DiceBody; formula?: { text: string; context(): MacroContext | undefined } }

/** What a call answers: the text the model reads, and plain JSON for the trace. */
export interface ToolAnswer { text: string; detail: Record<string, unknown> }
export type ToolArgs = Record<string, string | number | boolean>;


/** A name a provider takes for a function: a lowercase letter, then lowercase letters, digits and _, at most 60 (room for a number). */
export function callName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (/^[a-z]/.test(slug) ? slug : `tool_${slug}`).replace(/_+$/, "").slice(0, 60);
}

/** The name, or the name with the first free number after it (_2, _3, ...) when `taken` has it; the result joins `taken`. */
export function freeName(base: string, taken: Set<string>): string {
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}_${n}`;
  taken.add(name);
  return name;
}

export function toolParameters(fields: readonly ToolField[]): Record<string, unknown> {
  const prop = (f: ToolField) => ({
    type: f.type === "choice" || f.type === "text" ? "string" : f.type,
    description: f.description,
    ...(f.choices ? { enum: f.choices } : {}),
  });
  return {
    type: "object",
    properties: Object.fromEntries(fields.map((f) => [f.name, prop(f)])),
    required: fields.filter((f) => f.required).map((f) => f.name),
    additionalProperties: false,
  };
}

/** The function a provider is handed for a tool under its call name: what the model reads about it, and what a reply carries of it. */
export function toolDefinition(body: ToolBody, name: string): { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } } {
  return { type: "function", function: { name, description: body.description || body.name, parameters: toolParameters(body.fields) } };
}

/** The model's arguments checked against the fields once, and a roll's dice with them; an error is told to the model. */
export function readToolCall(body: ToolBody, raw: unknown): { args: ToolArgs } | { error: string } {
  const read = readToolArgs(body.fields, raw);
  if ("error" in read || body.action.kind !== "roll") return read;
  const notation = rollNotation(body, read.args);
  return boundedDice(notation) ? read : { error: `"${notation}" is not dice this tool can roll (${DICE_RULE}).` };
}

function readToolArgs(fields: readonly ToolField[], raw: unknown): { args: ToolArgs } | { error: string } {
  if (!isRecord(raw)) return { error: "Arguments must be an object." };
  const unknown = Object.keys(raw).filter((k) => !fields.some((f) => f.name === k));
  if (unknown.length > 0) return { error: `Unknown arguments: ${unknown.join(", ")}.` };
  const args: ToolArgs = {};
  for (const f of fields) {
    const v = Object.hasOwn(raw, f.name) ? raw[f.name] : undefined;
    if (v === undefined || v === null) {
      if (f.required) return { error: `${f.name} is required.` };
      continue;
    }
    const ok = f.type === "number" ? typeof v === "number" && Number.isFinite(v)
      : f.type === "boolean" ? typeof v === "boolean"
      : typeof v === "string" && (f.type === "text" || f.choices!.includes(v));
    if (!ok) return { error: f.type === "choice" ? `${f.name} must be one of: ${f.choices!.join(", ")}.` : `${f.name} must be a ${f.type}.` };
    args[f.name] = v as string | number | boolean;
  }
  return { args };
}

const rollNotation = (body: ToolBody, args: ToolArgs): string =>
  (body.action.kind === "roll" ? String(args[body.action.field] ?? "") : "").trim();

/** Runs the tool's action on arguments readToolCall accepted, with what its action links; throws, in words for the model, when a formula cannot run. */
export function runTool(body: ToolBody, args: ToolArgs, rand: () => number, links: ToolLinks = {}, deadline?: MacroDeadline): ToolAnswer {
  if (body.action.kind === "record") return { text: "Recorded.", detail: {} };
  if (body.action.kind === "dice") return rollDicePiece(links.dice!, rand);
  if (body.action.kind === "formula") {
    const context = links.formula!.context();
    if (!context) throw new Error("The scene is not ready to run formulas yet.");
    const out = runFormulaReadOnly(links.formula!.text, context, Math.floor(rand() * 2 ** 31) + 1, deadline);
    if ("error" in out) throw new Error(out.error);
    return { text: out.text, detail: { chars: out.text.length } };
  }
  const notation = rollNotation(body, args);
  const roll = rollDice(boundedDice(notation)!, rand);
  return { text: `Rolled ${notation}: ${rollSummary(roll)} = ${roll.total}`, detail: { dice: notation, ...roll } };
}
