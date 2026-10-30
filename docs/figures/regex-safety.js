// ─────────────────────────────────────────────────────────────
// regex-safety.js: figure data for docs/reference/security/regex-safety.md,
// keyed by figure id (flat map, matches docs/figures/regex.js). Prose
// lives in the .md and drops a figure in with a line like `@fig pipeline`;
// this file is the data behind that id. Copies the portfolio `flow`
// shape (site/data/figures.js); imports nothing. Renderer comes later,
// so the marker is inert for now.
// Grounded in src/core/regex/ast/parser.ts, src/core/regex/ast/redos.ts,
// src/core/regex/validate.ts, and src/core/regex/apply.ts (applyRule).
// ─────────────────────────────────────────────────────────────

export default {
  pipeline: {
    type: "flow",
    fig: "fig 01",
    title: "a card-authored pattern, before matching",
    caption:
      "The parser and analyzer inspect data. Validation includes a native syntax check and refuses " +
      "unsupported, suspicious or dangerous patterns before matching. Allocation limits bound " +
      "replacement construction; Studio workers add termination. Static screening is not a native-call deadline.",
    steps: [
      { label: "Find pattern string", sub: "untrusted, card-authored", color: "clay" },
      { label: "Parse to AST", sub: "parser.ts, unicode-mode grammar, never throws", color: "ochre" },
      { label: "Structural ReDoS scan", sub: "nested, sequential, alternation and backreference seams", color: "sage" },
      { label: "Gate: validateRule", sub: "unsafe or unsupported patterns refused before matching", color: "teal" },
      { label: "Match + bounded output", sub: "native calls cannot be preempted by a clock", color: "plum" },
    ],
  },
};
