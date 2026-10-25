/**
 * The one way a Compendium maintenance pass (tree build, Historian, Ingest) asks its model for structured data (04b F13): one
 * non-streaming request with the system and user text, the reply's reasoning cut away, the answer parsed once at the boundary, and
 * at most one repair request when the whole answer would not parse. A provider failure is the caller's to report (it throws); an
 * answer that stays unreadable comes back as a reason, never as an empty success. Nothing about the request is logged (F12).
 */
import { splitReasoning } from "../core/reasoning-tags";
import type { ProviderOptions } from "../stage/contracts/provider";
import type { Connected } from "./scene-turn";

export interface Messages { system: string; user: string }
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export interface Ask {
  model: string;
  options: ProviderOptions;
  signal?: AbortSignal;
}

/** One request; the text of the reply without its reasoning. */
export async function askText(connected: Connected, ask: Ask, m: Messages): Promise<string> {
  const done = await connected.provider.send({ model: ask.model, messages: [{ role: "system", content: m.system }, { role: "user", content: m.user }], options: { ...ask.options } }, ask.signal ? { signal: ask.signal } : {});
  return splitReasoning(done.content).reply;
}

/** The request, then the parse; when the parse refuses, one repair request built from the first and the refused answer, and the parse again. */
export async function askJson<T>(connected: Connected, ask: Ask, first: Messages, parse: (text: string) => Parsed<T>, repair: (first: Messages, answer: string, error: string) => Messages): Promise<Parsed<T>> {
  let text = await askText(connected, ask, first);
  let parsed = parse(text);
  if (parsed.ok) return parsed;
  text = await askText(connected, ask, repair(first, text, parsed.error));
  parsed = parse(text);
  return parsed.ok ? parsed : { ok: false, error: `the model's answer could not be read: ${parsed.error}` };
}
