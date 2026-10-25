/**
 * The Anti-Slop prompt (RoleCall lib/post-gen-actions/prompts.ts:421-678): the enabled banks of the attached sets, grouped under their set,
 * each at its depth (a depth sends the pattern, an action line, some examples and the replacement guidance), with the same phrase listed
 * under two banks sent once, entries the person pinned sent first and only if the catalog really holds them, banks that need turn history
 * left out when there is none, and the person's own banks in a section of their own.
 */
import { BANK_DEPTH, KIND_ACTION, depthFor, entryForms, getBank, getSet, resolveBankId, type Bank, type BankDepth } from "./banks";
import type { FinalCutPass } from "./pass";
import { noChangesDirective, recentContextBlock, type PromptContext, type PromptMessage } from "./prompt-shared";
import { toolFor } from "./tools";

const needsHistory = (b: Bank): boolean => b.scope === "turn-history" || b.kind === "pattern";

export function antiSlopMessages(input: string, p: FinalCutPass, context?: PromptContext, userBanks: Readonly<Record<string, Bank>> = {}): PromptMessage[] {
  const sets = p.attachedSets ?? [];
  const enabled = new Set((p.enabledBanks ?? []).map(resolveBankId));
  const defaultDepth: BankDepth = p.defaultDepth ?? "standard";
  const overrides = p.bankDepthOverrides ?? {};
  const pins = new Map<string, string[]>();
  for (const [raw, list] of Object.entries(p.pinnedBankExamples ?? {})) {
    if (Array.isArray(list)) pins.set(resolveBankId(raw), [...(pins.get(resolveBankId(raw)) ?? []), ...list.filter((e): e is string => typeof e === "string")]);
  }
  const hasHistory = (context?.recentMessages?.length ?? 0) >= 2;
  const skipped: string[] = [];
  const seen = new Set<string>();
  const mark = (examples: readonly string[]): void => { for (const e of examples) for (const f of entryForms(e)) seen.add(f); };
  const unique = (all: readonly string[], limit: number): { list: string[]; omitted: number } => {
    const list: string[] = [];
    let omitted = 0;
    for (const e of all) {
      if (list.length >= limit) break;
      const forms = entryForms(e);
      if (forms.length > 0 && forms.every((f) => seen.has(f))) { omitted++; continue; }
      list.push(e);
      for (const f of forms) seen.add(f);
    }
    return { list, omitted };
  };

  const render = (id: string, bank: Bank, userMade: boolean): string | null => {
    if (needsHistory(bank) && !hasHistory) { skipped.push(id); return null; }
    const depth = depthFor(id, defaultDepth, overrides);
    const cap = BANK_DEPTH[depth];
    const exactPins = userMade ? [] : [...new Set((pins.get(id) ?? []).filter((e) => bank.examples.includes(e)))];
    mark(exactPins);
    const { list, omitted } = unique(bank.examples.filter((e) => !exactPins.includes(e)), cap.examples);
    const sent = [...exactPins, ...list];
    const note = omitted > 0 ? ` (${omitted} shared entr${omitted === 1 ? "y" : "ies"} listed under earlier banks)` : "";
    const pinned = exactPins.length > 0 ? `; ${exactPins.length} pinned` : "";
    const block = sent.length === 0 ? ""
      : bank.kind === "wordbank"
        ? `  Banned entries (${sent.length}/${bank.examples.length}, case-insensitive incl. inflections${pinned})${note}:\n      ${sent.join(", ")}`
        : `  Examples (recognize these and variants${pinned})${note}:\n${sent.map((e) => `      - ${e}`).join("\n")}`;
    return [
      `  ## ${bank.label}  [${bank.kind}]${userMade ? " [user-authored]" : ""}${depth === defaultDepth ? "" : `  (depth=${depth})`}`,
      `  Pattern: ${bank.pattern || ""}`,
      cap.action || exactPins.length > 0 ? `  Action: ${KIND_ACTION[bank.kind]}` : "",
      block,
      cap.replace && bank.replace ? `  Replace with: ${bank.replace}` : "",
    ].filter(Boolean).join("\n");
  };

  const sections: string[] = [];
  for (const raw of sets) {
    const set = getSet(raw);
    if (!set) continue;
    const banks = set.banks.filter((id) => enabled.has(id)).flatMap((id) => { const b = getBank(id); const r = b && render(id, b, false); return r ? [r] : []; });
    if (banks.length > 0) sections.push(`# ${set.label}\n  ${set.description}\n\n${banks.join("\n\n")}`);
  }
  const mine = Object.entries(userBanks).flatMap(([id, b]) => { const r = render(id, b, true); return r ? [r] : []; });
  if (mine.length > 0) {
    sections.push(`# User-authored banks\n  Patterns the chat owner explicitly flagged. Treat with the same weight as built-in banks; the user wrote these because they kept seeing them.\n\n${mine.join("\n\n")}`);
  }

  const tool = (p.outputMode ?? "tool-call") === "tool-call";
  const name = toolFor("anti-slop")!.name;
  const answer = tool
    ? [`Call the ${name} tool exactly once with your result.`, "Place the rewritten body in the `refined` field (as a single string - preserve all original whitespace, line breaks, markdown, and inline HTML tags like <font color>, <details>, <spoiler>).", "Place per-bank changes in `changelog` as an array of `{ bank, change }` objects. One entry per bank that fired; empty array if nothing changed.", "Do NOT emit prose outside the tool call. Do NOT use [CHANGELOG] or [REFINED] markers - they are forbidden in this mode."].join(" ")
    : ["Return exactly two sections: [CHANGELOG] and [REFINED].", "Each changelog line must be `Bank: brief description of the change`."].join(" ");
  const recent = recentContextBlock(context, p.contextMessages, "Watch for repeated gestures, hedge clusters, sentence templates, and phrasing patterns reused across recent assistant messages - banks may fire on the current message even when individual phrases pass, if the pattern is repeating across the conversation.");
  return [
    {
      role: "system",
      content: [
        "You are the Anti-Slop Engine - a focused pattern-substitution agent that runs after the scene editor.",
        "Your only job is to find slopism patterns from the contract below and rewrite them in place.",
        "Do not reshape paragraphs, change voice, tense, or POV, or invent new prose. Pure phrase-level substitution.",
        "Each bank has a [kind] tag - read its [Action] line and apply that level of fix (phrase-substitute / structure-rewrite / technique-swap / lexical-replace / wordbank hard-ban).",
        "Preserve: dialogue (unless a phrase bank explicitly applies inside dialogue), macros ({{char}}, {{user}}, etc.), VN tags, markdown, inline HTML formatting tags (<font color>, <details>, <spoiler>, etc.), formatting, scene facts.",
        noChangesDirective("anti-slop", tool),
        answer,
        "",
        `Character: ${context?.characterName || "Unknown"}`,
        `Speaker role: ${context?.role || "assistant"}`,
        `Sets attached: ${sets.length}`,
        `Banks enabled: ${(p.enabledBanks ?? []).length}${skipped.length > 0 ? ` (${skipped.length} skipped - needs turn history)` : ""}`,
        `Default depth: ${defaultDepth}`,
        p.connection ? `Model: ${p.connection.model}` : "Model: scene default",
        `Output mode: ${tool ? "tool-call" : "tagged"}`,
        recent,
        "",
        "[BANKS]",
        sections.length > 0 ? sections.join("\n\n") : "(no banks enabled - pass should be a no-op)",
        "",
        p.customSlopisms ? `[USER WATCHLIST - additional phrases, treat as kind=phrase]\n${p.customSlopisms}` : "",
        p.antiSlopInstructions ? `[USER REPLACEMENT GUIDANCE - global override]\n${p.antiSlopInstructions}` : "",
      ].filter(Boolean).join("\n"),
    },
    {
      role: "user",
      content: tool ? `Original message:\n${input}\n\nCall ${name} with the rewritten body and a per-bank changelog.` : `Original message:\n${input}\n\nReturn [CHANGELOG] and [REFINED].`,
    },
  ];
}
