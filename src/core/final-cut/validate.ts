/**
 * The Output Safety Check and the refusal guard (RoleCall lib/post-gen-actions/validator.ts). The check is deterministic, no model: it
 * flags an empty reply, an unclosed code fence, unbalanced macro braces or action tags, control tags that leaked into the text and a
 * protected-block placeholder that was never restored. The guard says when an edit pass's answer is a refusal or a collapse that must
 * not replace the prose it was given.
 */
export interface ValidationIssue { code: string; severity: "warning" | "error"; message: string }

/** The six checks the panel lists, in RoleCall's words. */
export const QUALITY_CHECKS: readonly string[] = [
  "Blocks empty messages.",
  "Warns about unclosed markdown code fences.",
  "Warns about unbalanced macro braces like {{char}.",
  "Warns if [CHANGELOG], [REFINED], or [TRANSLATED] leaked into visible text.",
  "Blocks leaked protected syntax placeholders.",
  "Warns about unbalanced <action> tags.",
];

export function validateText(text: string): ValidationIssue[] {
  if (!text.trim()) return [{ code: "empty-message", severity: "error", message: "Message is empty." }];
  const issues: ValidationIssue[] = [];
  const count = (re: RegExp): number => text.match(re)?.length ?? 0;
  if (count(/```/g) % 2 !== 0) issues.push({ code: "unclosed-code-fence", severity: "warning", message: "A markdown code fence appears to be unclosed." });
  if (count(/\{\{/g) !== count(/\}\}/g)) issues.push({ code: "unbalanced-macro", severity: "warning", message: "Macro braces look unbalanced." });
  if (/\[(?:CHANGELOG|REFINED|TRANSLATED)\]/i.test(text)) issues.push({ code: "post-production-tag-leak", severity: "warning", message: "Final Cut control tags leaked into visible text." });
  if (/_+FC_PROTECTED(?:\b|_)/i.test(text)) issues.push({ code: "protected-block-token-leak", severity: "error", message: "A protected syntax placeholder leaked into visible text." });
  if (count(/<action\b[^>]*>/gi) !== count(/<\/action>/gi)) issues.push({ code: "unbalanced-action-tag", severity: "warning", message: "Action tags look unbalanced." });
  return issues;
}

export const summarizeIssues = (issues: readonly ValidationIssue[]): string[] => issues.map((i) => `${i.severity.toUpperCase()}: ${i.message}`);

/** Refusal phrasings in the languages the model pool fails in; each English one needs the assistant-voice frame so dialogue is safe. */
const REFUSALS: readonly RegExp[] = [
  /\b(?:i['’]m sorry,? but )?i (?:can(?:no|['’])t|cannot|am (?:not able|unable)) (?:to )?(?:help|assist|provide|generate|continue|comply|fulfill|create|do that)/i,
  /\bas an ai(?: language)? model\b/i,
  /\bi (?:will|must) not (?:provide|generate|continue|engage)/i,
  /(?:我|我们)(?:无法|不能|不可以)(?:给到|提供|继续|生成|协助|帮助|完成)/,
  /很抱歉.{0,12}(?:无法|不能)/,
  /申し訳(?:ありません|ございません).{0,20}(?:できません|いたしかねます)/,
  /(?:죄송합니다|죄송하지만).{0,20}(?:할 수 없습니다|드릴 수 없습니다)/,
];

const cjkRatio = (text: string): number => (text ? (text.match(/[぀-ヿ㐀-鿿가-힯]/g)?.length ?? 0) / text.length : 0);

/** Why an edit pass's answer must not replace its input, or null when it looks like a rewrite. A translator may change script. */
export function suspectRewrite(input: string, output: string, passType?: string): string | null {
  const a = input.trim();
  const b = output.trim();
  if (!a || !b) return null;
  if (a.length > 280 && b.length < a.length * 0.2 && REFUSALS.some((re) => re.test(b))) return "Output looks like a model refusal, not a rewrite";
  if (a.length > 400 && b.length < a.length * 0.08) return "Output collapsed to a fraction of the input";
  if (passType !== "translator") {
    const from = cjkRatio(a);
    const to = cjkRatio(b);
    if ((from < 0.05 && to > 0.5) || (from > 0.5 && to < 0.05)) return "Output switched writing system mid-pass";
  }
  return null;
}
