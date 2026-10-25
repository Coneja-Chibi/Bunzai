/** TypeScript syntax queries for shared-helper implementations, excluding inert text and imports. */
import ts from "typescript";

type Declaration = ts.FunctionDeclaration | ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.VariableDeclaration | ts.MethodDeclaration;
let previous: { source: string; kind: ts.ScriptKind; tree: ts.SourceFile; declarations: Map<string, Declaration[]>; calls: Map<string, number> } | undefined;
function syntax(path: string, source: string): ts.SourceFile {
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  if (previous?.source === source && previous.kind === kind) return previous.tree;
  // Unit detectors also accept a standalone private method fragment.
  const text = /^\s*private\s/.test(source) ? `class Fragment { ${source} }` : source;
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  const declarations = new Map<string, Declaration[]>();
  const calls = new Map<string, number>();
  some(tree, (node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isVariableDeclaration(node) || ts.isMethodDeclaration(node)) && node.name && ts.isIdentifier(node.name)) {
      const entries = declarations.get(node.name.text) ?? [];
      entries.push(node);
      declarations.set(node.name.text, entries);
    }
    if (ts.isCallExpression(node)) {
      const expression = unwrap(node.expression);
      const name = ts.isIdentifier(expression) ? expression.text
        : ts.isPropertyAccessExpression(expression) ? expression.name.text
        : ts.isElementAccessExpression(expression) && ts.isStringLiteral(expression.argumentExpression) ? expression.argumentExpression.text : undefined;
      if (name) calls.set(name, (calls.get(name) ?? 0) + 1);
    }
    return false;
  });
  previous = { source, kind, tree, declarations, calls };
  return tree;
}

function some(node: ts.Node, predicate: (node: ts.Node) => boolean): boolean {
  return predicate(node) || !!ts.forEachChild(node, (child) => some(child, predicate) || undefined);
}

const identifier = (node: ts.Node | undefined, name: string): boolean => !!node && ts.isIdentifier(node) && node.text === name;
function unwrap(node: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) node = node.expression;
  return node;
}

/** Calls in template substitutions count; literal template text, strings and regexes do not. */
export function callsNamed(path: string, source: string, name: string): number {
  if (!source.includes(name) && !source.includes("\\u")) return 0;
  syntax(path, source);
  return previous!.calls.get(name) ?? 0;
}

function importedGuard(tree: ts.SourceFile, path: string): string | undefined {
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.importClause?.isTypeOnly) continue;
    const parts = [...path.split("/").slice(0, -1), ...node.moduleSpecifier.text.split("/")];
    const resolved: string[] = [];
    for (const part of parts) { if (part === "..") resolved.pop(); else if (part !== ".") resolved.push(part); }
    if (resolved.join("/").replace(/\.ts$/, "") !== "src/stage/store/chat-rules") continue;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const guard = bindings.elements.find((item) => !item.isTypeOnly && (item.propertyName ?? item.name).text === "requireVersion");
    if (guard) return guard.name.text;
  }
  return undefined;
}

function versionAdapter(tree: ts.SourceFile, path: string, fn: ts.FunctionLikeDeclaration): boolean {
  const guard = importedGuard(tree, path);
  if (!guard || fn.parameters.length !== 2 || !fn.body || !ts.isBlock(fn.body)) return false;
  const [actual, expected] = fn.parameters;
  if (!actual || !expected || !ts.isIdentifier(actual.name) || !ts.isIdentifier(expected.name) || actual.initializer || expected.initializer) return false;
  let branch = actual.name.text;
  const statements = [...fn.body.statements];
  if (statements.length === 2) {
    const lookup = statements.shift()!;
    if (!ts.isVariableStatement(lookup) || !(lookup.declarationList.flags & ts.NodeFlags.Const) || lookup.declarationList.declarations.length !== 1) return false;
    const declaration = lookup.declarationList.declarations[0]!;
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return false;
    const call = unwrap(declaration.initializer);
    if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== "get" || !ts.isIdentifier(call.expression.expression) || call.arguments.length !== 1 || !identifier(call.arguments[0], branch)) return false;
    branch = declaration.name.text;
  }
  if (statements.length !== 1 || !ts.isExpressionStatement(statements[0]!)) return false;
  const call = unwrap(statements[0]!.expression);
  if (!ts.isCallExpression(call) || !identifier(call.expression, guard) || call.arguments.length !== 2) return false;
  const version = unwrap(call.arguments[0]!);
  return ts.isPropertyAccessExpression(version) && identifier(version.expression, branch) && version.name.text === "version" && identifier(call.arguments[1], expected.name.text);
}

function bespokeFetch(fn: ts.FunctionLikeDeclaration): boolean {
  if (!fn.body) return false;
  let factory = false;
  let response = false;
  some(fn.body, (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const names = node.properties.map((property) => property.name?.getText());
      if (names.includes("fetch") && names.includes("sent")) factory = true;
    }
    if (ts.isNewExpression(node) && identifier(node.expression, "Response")) response = true;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && identifier(node.expression.expression, "Response")) response = true;
    return false;
  });
  return response && !factory;
}

/** Named declarations are syntax, not import specifiers or incidental text in fixture programs. */
export function declaresShared(path: string, source: string, name: string): boolean {
  if (!source.includes(name) && !source.includes("\\u")) return false;
  const tree = syntax(path, source);
  return (previous!.declarations.get(name) ?? []).some((node) => {
    const fn = ts.isVariableDeclaration(node) && node.initializer ? unwrap(node.initializer) : node;
    const callable = ts.isFunctionDeclaration(fn) || ts.isArrowFunction(fn) || ts.isFunctionExpression(fn) || ts.isMethodDeclaration(fn);
    if (name === "tick") {
      // The provider helper is a zero-delay Promise, not a UI animation counter or progress callback.
      return callable && !!fn.body && some(fn.body, (child) => ts.isNewExpression(child) && identifier(child.expression, "Promise")) && some(fn.body, (child) => ts.isCallExpression(child) && identifier(child.expression, "setTimeout") && child.arguments.length === 2 && ts.isNumericLiteral(child.arguments[1]!) && child.arguments[1]!.text === "0");
    }
    if (name === "fakeFetch" && callable && bespokeFetch(fn)) return false;
    if (name === "requireVersion" && callable && versionAdapter(tree, path, fn)) return false;
    return true;
  });
}

/**
 * Calls to node:fs open/openSync whose flags can write: `w`, `a`, `+` (r+, w+, a+), `x`. A string
 * literal without those letters ("r", "rs") or no flags at all is read-only. Flags the reader cannot
 * see (an identifier, a number, an expression) fail closed as writes. `locals` maps a local binding to
 * its node:fs name; `namespaces` are fs / fs.promises objects. Returns one entry per write-capable call.
 */
export function writeCapableFsOpens(path: string, source: string, locals: ReadonlyMap<string, string>, namespaces: readonly string[]): string[] {
  const tree = syntax(path, source);
  const writes: string[] = [];
  some(tree, (node) => {
    if (!ts.isCallExpression(node)) return false;
    const callee = unwrap(node.expression);
    let name: string | undefined;
    if (ts.isIdentifier(callee)) name = locals.get(callee.text);
    else {
      const member = ts.isPropertyAccessExpression(callee) ? callee.name.text
        : ts.isElementAccessExpression(callee) && ts.isStringLiteralLike(callee.argumentExpression) ? callee.argumentExpression.text : undefined;
      let owner = unwrap(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee) ? callee.expression : callee);
      if (ts.isPropertyAccessExpression(owner) && owner.name.text === "promises") owner = unwrap(owner.expression);
      if ((member === "open" || member === "openSync") && ts.isIdentifier(owner) && namespaces.includes(owner.text)) name = member;
    }
    if (!name) return false;
    const flags = node.arguments[1] ? unwrap(node.arguments[1]) : undefined;
    const readOnly = !flags || (ts.isIdentifier(flags) && flags.text === "undefined")
      || (ts.isStringLiteralLike(flags) && !/[wax+]/.test(flags.text));
    if (!readOnly) writes.push(name);
    return false;
  });
  return writes;
}
