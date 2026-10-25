/**
 * {{calc::expr}} - safe arithmetic over already-expanded values, so derived numbers (e.g. a
 * countdown, `floor - since_start`) can be displayed without mutating any variable. Ported
 * verbatim from RoleCall: a hand-rolled tokenizer and
 * recursive-descent parser over `+ - * / % ( )` and `min/max/floor/ceil/round/abs/clamp`. No
 * `eval`, no `Function`: this satisfies ADR-012's "no dynamic code" constraint by construction.
 */
import type { MacroDefinition, MacroResult } from "../types";
import { toErrorMessage } from "../../../error-message";

type Token =
  | { kind: "num"; value: number }
  | { kind: "op"; value: "+" | "-" | "*" | "/" | "%" }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" }
  | { kind: "fn"; value: string };

const FUNCTIONS: Record<string, { arity: [number, number]; apply: (args: number[]) => number }> = {
  min: { arity: [1, 8], apply: (a) => Math.min(...a) },
  max: { arity: [1, 8], apply: (a) => Math.max(...a) },
  floor: { arity: [1, 1], apply: ([x]) => Math.floor(x ?? NaN) },
  ceil: { arity: [1, 1], apply: ([x]) => Math.ceil(x ?? NaN) },
  round: { arity: [1, 1], apply: ([x]) => Math.round(x ?? NaN) },
  abs: { arity: [1, 1], apply: ([x]) => Math.abs(x ?? NaN) },
  clamp: { arity: [3, 3], apply: ([x, lo, hi]) => Math.min(Math.max(x ?? NaN, lo ?? NaN), hi ?? NaN) },
};

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i] ?? "";
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma" });
      i++;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "%") {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^\d*\.?\d+/.exec(expr.slice(i));
      if (!m) throw new Error(`bad number at "${expr.slice(i, i + 8)}"`);
      tokens.push({ kind: "num", value: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const m = /^[a-zA-Z_][\w]*/.exec(expr.slice(i));
      if (!m) throw new Error(`bad identifier at "${expr.slice(i, i + 8)}"`);
      const name = m[0].toLowerCase();
      if (!FUNCTIONS[name]) throw new Error(`unknown function "${m[0]}"`);
      tokens.push({ kind: "fn", value: name });
      i += m[0].length;
      continue;
    }
    throw new Error(`unexpected character "${ch}"`);
  }
  return tokens;
}

/** Recursive-descent: expr := term (('+'|'-') term)*, term := unary (('*'|'/'|'%') unary)* */
function parseExpression(tokens: Token[], pos: { i: number }): number {
  let left = parseTerm(tokens, pos);
  while (pos.i < tokens.length) {
    const t = tokens[pos.i];
    if (!t || t.kind !== "op" || (t.value !== "+" && t.value !== "-")) break;
    pos.i++;
    const right = parseTerm(tokens, pos);
    left = t.value === "+" ? left + right : left - right;
  }
  return left;
}

function parseTerm(tokens: Token[], pos: { i: number }): number {
  let left = parseUnary(tokens, pos);
  while (pos.i < tokens.length) {
    const t = tokens[pos.i];
    if (!t || t.kind !== "op" || (t.value !== "*" && t.value !== "/" && t.value !== "%")) break;
    pos.i++;
    const right = parseUnary(tokens, pos);
    if (t.value === "*") left = left * right;
    else if (t.value === "/") left = left / right;
    else left = left % right;
  }
  return left;
}

function parseUnary(tokens: Token[], pos: { i: number }): number {
  const t = tokens[pos.i];
  if (t?.kind === "op" && (t.value === "-" || t.value === "+")) {
    pos.i++;
    const v = parseUnary(tokens, pos);
    return t.value === "-" ? -v : v;
  }
  return parsePrimary(tokens, pos);
}

function parsePrimary(tokens: Token[], pos: { i: number }): number {
  const t = tokens[pos.i];
  if (!t) throw new Error("unexpected end of expression");
  if (t.kind === "num") {
    pos.i++;
    return t.value;
  }
  if (t.kind === "lparen") {
    pos.i++;
    const v = parseExpression(tokens, pos);
    if (tokens[pos.i]?.kind !== "rparen") throw new Error('missing ")"');
    pos.i++;
    return v;
  }
  if (t.kind === "fn") {
    const fn = FUNCTIONS[t.value];
    if (!fn) throw new Error(`unknown function "${t.value}"`);
    pos.i++;
    if (tokens[pos.i]?.kind !== "lparen") throw new Error(`${t.value} needs "("`);
    pos.i++;
    const args: number[] = [parseExpression(tokens, pos)];
    while (tokens[pos.i]?.kind === "comma") {
      pos.i++;
      args.push(parseExpression(tokens, pos));
    }
    if (tokens[pos.i]?.kind !== "rparen") throw new Error(`missing ")" after ${t.value}(`);
    pos.i++;
    if (args.length < fn.arity[0] || args.length > fn.arity[1]) {
      throw new Error(`${t.value} takes ${fn.arity[0] === fn.arity[1] ? fn.arity[0] : `${fn.arity[0]}-${fn.arity[1]}`} args`);
    }
    return fn.apply(args);
  }
  throw new Error('expected a number, "(", or a function');
}

/** Evaluate an arithmetic expression string. Throws on any syntax error. */
export function evaluateArithmetic(expr: string): number {
  const tokens = tokenize(expr);
  if (tokens.length === 0) throw new Error("empty expression");
  const pos = { i: 0 };
  const value = parseExpression(tokens, pos);
  if (pos.i !== tokens.length) throw new Error("trailing input in expression");
  return value;
}

/** Format a result without float noise (0.1 + 0.2 renders as 0.3). */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) throw new Error("result is not a finite number");
  return String(Math.round(n * 1e9) / 1e9);
}

/**
 * {{calc::expression}} - inner macros expand before calc runs, so
 * {{calc::{{getvar::floor}} - {{getvar::since}}}} works. Unset variables expand to "" - a lone
 * empty operand is a parse error, surfacing as an empty render plus a macro error, not garbage.
 */
const calcMacro: MacroDefinition = {
  name: "calc",
  aliases: ["math"],
  description: "Evaluate arithmetic: + - * / % ( ) and min/max/floor/ceil/round/abs/clamp.",
  args: [{ name: "expression", description: "Arithmetic expression", required: true }],
  category: "conditional",
  handler: (args: string[]): MacroResult => {
    // Args may contain "," inside min(a, b); "::" never appears in arithmetic, but rejoin
    // defensively in case a caller passes extra segments.
    const expr = args.join("::").trim();
    if (!expr) return { value: "", success: false, error: "calc requires an expression" };
    try {
      return { value: formatNumber(evaluateArithmetic(expr)), success: true };
    } catch (err) {
      return { value: "", success: false, error: `calc: ${toErrorMessage(err, "invalid expression")}` };
    }
  },
};

export const MATH_MACROS: readonly MacroDefinition[] = [calcMacro];
