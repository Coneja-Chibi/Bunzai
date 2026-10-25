/**
 * One Final Cut pass over a piece of text (RoleCall lib/post-gen-actions/service.ts:229-819 and :943-1036). The Output Safety Check reads
 * the text and warns. A model pass hides the structured blocks, asks its model (a forced tool call, or the tagged sections when the
 * connection takes no tools), tries once more when the first answer failed in a way a second try can mend, asks the model to apply
 * its own changelog when it forgot the body, then puts the blocks back and refuses an answer that lost one, came back empty or leaked a
 * placeholder. A pass never throws for a bad answer: it returns skipped or failed with the reason, and the pipeline's failure mode decides.
 */
import { FinalCutRegexError } from "./final-cut-regex";
import { buildWordDiff, type DiffSegment } from "../core/final-cut/diff";
import { passModelOptions } from "./final-cut-options";
import { antiSlopMessages } from "../core/final-cut/prompt-antislop";
import type { Bank } from "../core/final-cut/banks";
import { changelogFromTool, detectMarker, parseTagged, ruleReviewOf, toolArgs, toolArgsFromText, type ChangelogItem, type RuleReviewEntry } from "../core/final-cut/parse";
import type { FinalCutPass, PassType } from "../core/final-cut/pass";
import { protectStructuredBlocks, findMissingProtectedBlocks, restoreStructuredBlocks } from "../core/final-cut/protect";
import { customAgentMessages, editorMessages, translatorMessages, type RulebookEntry } from "../core/final-cut/prompts";
import type { PromptContext, PromptMessage } from "../core/final-cut/prompt-shared";
import { toolFor } from "../core/final-cut/tools";
import { summarizeIssues, suspectRewrite, validateText } from "../core/final-cut/validate";
import type { ProviderCompletion, ProviderOptions } from "../stage/contracts/provider";
import { toErrorMessage } from "../error-message";
import { PassFailure, classify, failureMessage, retryable } from "./final-cut-errors";
import type { Connected } from "./scene-turn";

export interface PassResult {
  id: string;
  type: PassType;
  label?: string;
  status: "applied" | "skipped" | "failed";
  changelog: ChangelogItem[];
  warnings: string[];
  /** Empty unless the text changed. */
  diff: DiffSegment[];
  changed: boolean;
  model?: string;
  durationMs: number;
  ruleReview?: RuleReviewEntry[];
  /** What the model sent back, as text, for the activity view's Raw tab. */
  raw?: string;
  /** The first answer named changes but no body, so the model was asked to apply its own list. */
  reflected?: boolean;
  /** The text this pass hands the next one (the input when it did not apply). Not stored. */
  output: string;
}

export interface PassEnv {
  /** The model's connection for this pass, or null when Kit no longer has it. */
  open(connection: { id: string; model: string }): Promise<Connected | null>;
  scene: { id: string; model: string };
  context: PromptContext;
  rulebook: readonly RulebookEntry[];
  userBanks: Readonly<Record<string, Bank>>;
  signal: AbortSignal;
  now(): number;
  /** Cuts thinking from the text a pass reads; absent leaves it alone. */
  strip?(text: string): string;
  /** The scene's AI-output regex on a pass's input (final-cut-regex.ts); absent when the scene has none. It throws FinalCutRegexError, which ends the run. */
  regexInput?(text: string): Promise<string>;
}

const wait = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });

const messagesFor = (p: FinalCutPass, text: string, env: PassEnv): PromptMessage[] =>
  p.type === "translator" ? translatorMessages(text, p, env.context)
    : p.type === "anti-slop" ? antiSlopMessages(text, p, env.context, env.userBanks)
      : p.type === "custom-agent" ? customAgentMessages(text, p, env.context, env.rulebook)
        : editorMessages(text, p, env.context);

/** One attempt: sends, and throws a PassFailure when the answer is empty or not in the shape asked for. */
async function attempt(connected: Connected, model: string, messages: PromptMessage[], options: ProviderOptions, spec: ReturnType<typeof toolFor>, useTool: boolean, signal: AbortSignal): Promise<ProviderCompletion> {
  const completion = await connected.provider.send({ model, messages, options }, { signal });
  const truncated = completion.finish_reason === "length";
  if (useTool && spec) {
    const calls = completion.tool_calls ?? [];
    const call = calls.find((c) => c.function.name === spec.name) ?? (calls.length === 1 ? calls[0] : undefined);
    const args = call ? toolArgs(call.function.arguments) : toolArgsFromText(completion.content, spec.bodyField);
    if (!args) {
      if (!call && truncated) throw new PassFailure(completion.content?.trim() ? "truncation" : "reasoning_exhausted", completion.content);
      throw new PassFailure(call ? (truncated ? "truncation" : "malformed_args") : "no_tool_call", completion.content);
    }
  } else if (!completion.content?.trim()) {
    throw new PassFailure(truncated ? "truncation" : "empty_completion");
  }
  return completion;
}

async function ask(connected: Connected, model: string, messages: PromptMessage[], base: ProviderOptions, spec: ReturnType<typeof toolFor>, useTool: boolean, signal: AbortSignal): Promise<ProviderCompletion> {
  try {
    return await attempt(connected, model, messages, base, spec, useTool, signal);
  } catch (first) {
    if (signal.aborted) throw first;
    const klass = classify(first);
    if (!retryable(klass)) throw first;
    await wait(500, signal);
    if (signal.aborted) throw first;
    const options = klass === "truncation" && typeof base.max_tokens === "number" ? { ...base, max_tokens: Math.min(Math.ceil(base.max_tokens * 1.5), 64_000) } : base;
    return attempt(connected, model, messages, options, spec, useTool, signal);
  }
}

const done = (p: FinalCutPass, input: string, partial: Partial<PassResult>, started: number, env: PassEnv): PassResult => ({
  id: p.id, type: p.type, ...(p.label ? { label: p.label } : {}), status: "applied", changelog: [], warnings: [], diff: [], changed: false,
  durationMs: env.now() - started, output: input, ...partial,
});

export async function runPass(p: FinalCutPass, input: string, env: PassEnv): Promise<PassResult> {
  const started = env.now();
  if (p.type === "validator") {
    // RoleCall's check only warns on a reply; with Block generation set, an error (an empty or placeholder-ridden text) now blocks, as the panel says.
    const issues = validateText(input);
    return done(p, input, { warnings: summarizeIssues(issues), ...(p.failureMode === "block" && issues.some((i) => i.severity === "error") ? { status: "failed" as const } : {}) }, started, env);
  }
  const conn = p.connection ?? env.scene;
  const base: Partial<PassResult> = { model: conn.model };
  try {
    const connected = await env.open(conn);
    if (!connected) throw new PassFailure("auth", undefined, "this pass's connection is gone from Kit; pick another in the pass's model setting");
    const spec = toolFor(p.type);
    const wantsTool = (p.outputMode ?? "tool-call") === "tool-call" && spec !== null;
    const useTool = wantsTool && connected.tools === true;
    const pass: FinalCutPass = { ...p, outputMode: useTool ? "tool-call" : "tagged" };
    const warnings = wantsTool && !useTool ? ["This connection does not take tool calls, so the pass ran in tagged mode."] : [];
    const stripped = p.stripThinkingFromInput === false || !env.strip ? input : env.strip(input);
    const prepared = p.applyRegexToInput === false || !env.regexInput ? stripped : await env.regexInput(stripped);
    const hidden = protectStructuredBlocks(prepared);
    const messages = messagesFor(pass, hidden.text, env);
    const options = passModelOptions(pass, input.length, useTool ? spec : null);
    const completion = await ask(connected, conn.model, messages, options, spec, useTool, env.signal);
    let text = "";
    let changelog: ChangelogItem[] = [];
    let ruleReview: RuleReviewEntry[] | undefined;
    let noChanges = false;
    let alreadyThere = false;
    let reflected = false;
    let raw = completion.content ?? "";
    const tag = p.type === "translator" ? "TRANSLATED" : "REFINED";
    if (useTool && spec) {
      const calls = completion.tool_calls ?? [];
      const call = calls.find((c) => c.function.name === spec.name) ?? (calls.length === 1 ? calls[0] : undefined);
      const args = (call ? toolArgs(call.function.arguments) : toolArgsFromText(completion.content, spec.bodyField))!;
      raw = call ? (typeof call.function.arguments === "string" ? call.function.arguments : JSON.stringify(call.function.arguments)) : completion.content;
      const body = args[spec.bodyField];
      if (typeof body !== "string" || !body.trim()) throw new PassFailure("empty_body", raw);
      text = body;
      changelog = changelogFromTool(args["changelog"], spec.changelogShape);
      noChanges = args["no_changes_needed"] === true;
      alreadyThere = p.type === "translator" && args["already_in_target_language"] === true;
      ruleReview = ruleReviewOf(args["rule_review"]);
    } else {
      const answer = completion.content.trim();
      raw = answer;
      noChanges = detectMarker(answer, "NO_CHANGES_NEEDED");
      alreadyThere = p.type === "translator" && detectMarker(answer, "ALREADY_IN_TARGET");
      const parsed = parseTagged(answer, tag);
      text = parsed.text;
      changelog = parsed.changelog;
      warnings.push(...parsed.warnings);
      if (!noChanges && !alreadyThere && !text.trim() && changelog.length > 0) {
        // The model listed its changes and forgot the body: hand it its own list and ask for the execution only.
        const list = changelog.map((c) => `- ${c.rule}: ${c.description}`).join("\n");
        const again: PromptMessage[] = [
          { role: "system", content: [
            "You are an executor agent. Your only job is to apply a list of edits to a body of text and return the rewritten text.", "",
            `Output format: the rewritten text MUST be wrapped in [${tag}]...[/${tag}] markers. No other content. No changelog. No rule list. No commentary. No preamble. Just the rewritten prose inside the markers.`, "",
            "If a listed change cannot be cleanly applied (e.g. the target phrase isn't actually in the text), skip that one silently - do not explain.",
          ].join("\n") },
          { role: "user", content: ["Apply these changes to the text below.", "", "Changes to apply:", list, "", "Original text:", hidden.text, "", `Return only the rewritten text inside [${tag}]...[/${tag}].`].join("\n") },
        ];
        try {
          const second = await connected.provider.send({ model: conn.model, messages: again, options: passModelOptions({ ...pass, outputMode: "tagged" }, input.length, null) }, { signal: env.signal });
          const redo = parseTagged(second.content.trim(), tag);
          if (redo.text.trim()) {
            text = redo.text;
            changelog = [...changelog, ...redo.changelog];
            warnings.push("Reflection retry: model committed to changes but didn't apply them on first pass; succeeded on the follow-up.");
            reflected = true;
          } else warnings.push("Reflection retry: model still did not emit the body on the follow-up. Falling back to original input.");
        } catch (e) {
          if (env.signal.aborted) throw e;
          warnings.push(`Reflection retry failed: ${toErrorMessage(e)}. Falling back to original input.`);
        }
      }
    }
    const kept = (more: Partial<PassResult>): PassResult => done(p, input, { ...base, changelog, warnings, ...(ruleReview ? { ruleReview } : {}), raw: raw.slice(0, 6_000), ...(reflected ? { reflected } : {}), ...more }, started, env);
    if (noChanges) return kept({ changelog: changelog.length > 0 ? changelog : [{ rule: "No changes needed", description: `${p.type} pass reviewed the input and had nothing to change.` }] });
    if (alreadyThere) return kept({ changelog: [...changelog, { rule: "Language detection", description: `Source already in target language (${p.targetLanguage || "target"}); no translation applied.` }] });
    const restored = restoreStructuredBlocks(text, hidden.blocks);
    const leak = validateText(restored).find((i) => i.code === "protected-block-token-leak");
    if (leak) return kept({ status: "skipped", warnings: [...warnings, `${leak.message} Original text was kept.`] });
    const missing = findMissingProtectedBlocks(restored, hidden.blocks);
    if (missing.length) warnings.push(`Protected syntax was not preserved: ${missing.map((b) => b.kind).join(", ")}`);
    if (missing.length && p.failureMode === "fallback") return kept({ status: "skipped", warnings });
    if (!restored.trim()) return kept({ status: "skipped", warnings: [...warnings, "Pass produced no body text; falling back to original input."] });
    const suspect = suspectRewrite(prepared, restored, p.type);
    if (suspect) warnings.push(`${suspect} - double-check this pass and undo it from the message's Final Cut activity if it mangled the text.`);
    return kept({ warnings, output: restored, changed: restored !== input, diff: restored !== input ? buildWordDiff(input, restored) : [] });
  } catch (error) {
    if (error instanceof FinalCutRegexError) throw error;
    return done(p, input, { ...base, status: "failed", warnings: [failureMessage(error)], ...(error instanceof PassFailure && error.raw ? { raw: error.raw.slice(0, 6_000) } : {}) }, started, env);
  }
}
