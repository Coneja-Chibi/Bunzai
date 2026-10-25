/**
 * The proofs every variant stylesheet owes, in one place so scenes, settings, editors and controls cannot
 * drift: each rule sits under its own root attribute, corners stay square, colors come from tokens, focus
 * stays visible, and nothing hides a control. Returns the problems found; an empty list passes.
 * Test-only: no production module imports this.
 */
export function variantCssProblems(css: string, scope: RegExp, controls: RegExp): string[] {
  const problems: string[] = [];
  const rules = css.replace(/@(media|container)[^{]*\{/g, "").replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "").split("}")
    .map((r) => r.split("{") as [string, string?]).filter((r): r is [string, string] => r[1] !== undefined);
  if (rules.length === 0) problems.push("no rules");
  for (const [selector, body] of rules) for (const part of selector.split(/,(?![^(]*\))/).map((p) => p.trim())) {
    if (!scope.test(part)) problems.push(`unscoped selector: ${part}`);
    if (/display:\s*none|visibility:\s*hidden/.test(body) && controls.test(part)) problems.push(`hides a control: ${part}`);
  }
  if (/border-radius:\s*(?!0[;}])/.test(css)) problems.push("sets a radius above zero");
  if (/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(css)) problems.push("uses a literal color");
  if (/outline:\s*(none|0)\b/.test(css)) problems.push("removes an outline");
  return problems;
}
