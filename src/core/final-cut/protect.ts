/**
 * Structured blocks a pass must never touch (RoleCall lib/post-gen-actions/protected-blocks.ts): code fences, macros, angle tags and
 * [UPPER] tags are swapped for placeholders before the model sees the text and swapped back after, and a result that lost one is
 * caught. The placeholder prefix is reserved: one left in visible text is a leak (validate.ts).
 */
export interface ProtectedBlock { token: string; value: string; kind: string }
export interface ProtectedText { text: string; blocks: ProtectedBlock[] }

const PATTERNS: ReadonlyArray<{ kind: string; pattern: RegExp }> = [
  { kind: "code_fence", pattern: /```[\s\S]*?```/g },
  { kind: "macro", pattern: /\{\{[\s\S]*?\}\}/g },
  { kind: "angle_tag", pattern: /<[^>\n]{1,160}>/g },
  { kind: "vn_tag", pattern: /\[[A-Z][A-Z0-9_:-]*(?:[^\]\n]{0,240})\]/g },
];

export function protectStructuredBlocks(input: string): ProtectedText {
  let text = input;
  const blocks: ProtectedBlock[] = [];
  for (const { kind, pattern } of PATTERNS) {
    text = text.replace(pattern, (value) => {
      const token = `__FC_PROTECTED_${blocks.length}_${kind.toUpperCase()}__`;
      blocks.push({ token, value, kind });
      return token;
    });
  }
  return { text, blocks };
}

export function restoreStructuredBlocks(input: string, blocks: readonly ProtectedBlock[]): string {
  return blocks.reduce((text, block) => text.split(block.token).join(block.value), input);
}

/** The blocks the output no longer holds. */
export const findMissingProtectedBlocks = (output: string, blocks: readonly ProtectedBlock[]): ProtectedBlock[] => blocks.filter((b) => !output.includes(b.value));
