/**
 * Unbounded-list detection (pure), the check behind "long lists go through useVirtualRows" (AGENTS.md rule 12). Flags a JSX
 * `.map(...)` whose callback returns a row-like element (a Card, ListRow, MenuItem or Tile part, or any element carrying
 * `key`) in a file that never calls useVirtualRows. A `bounded-ok: <reason>` comment on the map or the line before it
 * exempts a list that is bounded by construction. A heuristic: it cannot see how long the collection is, so it only
 * exempts receivers that are statically small: array literals, module-level consts (or SCREAMING_CASE imports) built from
 * literals, `.slice` with a literal bound up to 50, `Object.entries/keys/values` of a literal object, and
 * `Array.from({ length: N })` with literal N up to 50. Filter/sort/reverse over such a receiver stay exempt.
 */
import ts from "typescript";

const ROW_PARTS = new Set(["ListRow", "MenuItem", "Card", "Tile"]);
export type UnboundedList = { id: string; file: string; line: number; part: string };

function rowElement(node: ts.Node): ts.JsxOpeningLikeElement | undefined {
  if (ts.isParenthesizedExpression(node)) return rowElement(node.expression);
  if (ts.isJsxElement(node)) return node.openingElement;
  if (ts.isJsxSelfClosingElement(node)) return node;
  return undefined;
}

function returned(fn: ts.ArrowFunction | ts.FunctionExpression): ts.Node[] {
  if (!ts.isBlock(fn.body)) return [fn.body];
  const out: ts.Node[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isReturnStatement(n) && n.expression) out.push(n.expression);
    else if (!ts.isFunctionLike(n)) ts.forEachChild(n, visit);
  };
  visit(fn.body);
  return out;
}

/** True when the nearest enclosing function boundary is crossed only through a JSX expression container. */
function insideJsx(node: ts.Node): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxExpression(p)) return true;
    if (ts.isFunctionLike(p)) return false;
  }
  return false;
}

const MAX_LITERAL = 50;
const SHAPE_ONLY = new Set(["filter", "sort", "reverse", "toSorted", "toReversed", "flat"]);

const literalNumber = (n: ts.Node | undefined): number | undefined => {
  if (!n) return undefined;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) return -Number(n.operand.text);
  return undefined;
};

/** True when the expression is statically a small collection, so mapping it cannot grow with user data. */
function staticallyBounded(sf: ts.SourceFile, expr: ts.Expression, depth = 0): boolean {
  if (depth > 8) return false;
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isNonNullExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isTypeAssertionExpression(expr)) return staticallyBounded(sf, expr.expression, depth + 1);
  if (ts.isArrayLiteralExpression(expr)) return expr.elements.every((e) => !ts.isSpreadElement(e) || staticallyBounded(sf, e.expression, depth + 1));
  if (ts.isObjectLiteralExpression(expr)) return true;
  if (ts.isIdentifier(expr)) {
    for (const st of sf.statements) {
      if (ts.isVariableStatement(st) && st.declarationList.flags & ts.NodeFlags.Const) {
        const d = st.declarationList.declarations.find((x) => ts.isIdentifier(x.name) && x.name.text === expr.text);
        if (d) return !!d.initializer && staticallyBounded(sf, d.initializer, depth + 1);
      }
      if (ts.isImportDeclaration(st) && st.importClause) {
        const b = st.importClause.namedBindings;
        if (b && ts.isNamedImports(b) && b.elements.some((e) => e.name.text === expr.text)) return /^[A-Z][A-Z0-9_]*$/.test(expr.text);
      }
    }
    return false;
  }
  if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression)) {
    const callee = expr.expression;
    const name = callee.name.text;
    if (name === "slice") {
      const [a, b] = expr.arguments.map(literalNumber);
      const small = (n: number | undefined): boolean => n !== undefined && Math.abs(n) <= MAX_LITERAL;
      if (expr.arguments.length === 1 && a !== undefined && a < 0 && small(a)) return true;
      if (expr.arguments.length === 2 && a === 0 && small(b)) return true;
      return staticallyBounded(sf, callee.expression, depth + 1);
    }
    if (SHAPE_ONLY.has(name)) return staticallyBounded(sf, callee.expression, depth + 1);
    const owner = callee.expression.getText(sf);
    if (owner === "Object" && ["entries", "keys", "values"].includes(name)) return !!expr.arguments[0] && staticallyBounded(sf, expr.arguments[0], depth + 1);
    if (owner === "Array" && name === "from") {
      const arg = expr.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        const len = arg.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(sf) === "length");
        const n = literalNumber(len?.initializer);
        return n !== undefined && n >= 0 && n <= MAX_LITERAL;
      }
      return !!arg && staticallyBounded(sf, arg, depth + 1);
    }
  }
  return false;
}

export function unboundedLists(file: string, source: string): UnboundedList[] {
  if (/\buseVirtualRows\s*[(<]/.test(source)) return [];
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines = source.split("\n");
  const seen = new Map<string, number>();
  const out: UnboundedList[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "map" && insideJsx(node)) {
      const cb = node.arguments[0];
      if (cb && !staticallyBounded(sf, node.expression.expression) && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) {
        const el = returned(cb).map(rowElement).find((e) => e && (ROW_PARTS.has(e.tagName.getText(sf)) || e.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === "key")));
        const first = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
        const last = sf.getLineAndCharacterOfPosition(node.getEnd()).line;
        if (el && !lines.slice(Math.max(0, first - 1), last + 1).join("\n").includes("bounded-ok")) {
          let owner = "(module)";
          for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
            if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) { owner = p.name.getText(sf); break; }
            if (ts.isVariableDeclaration(p) && p.initializer && ts.isFunctionLike(p.initializer)) { owner = p.name.getText(sf); break; }
          }
          const part = el.tagName.getText(sf);
          const base = `${file}::${owner}::${part}`;
          const n = (seen.get(base) ?? 0) + 1;
          seen.set(base, n);
          out.push({ id: n === 1 ? base : `${base}#${n}`, file, line: first + 1, part });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
