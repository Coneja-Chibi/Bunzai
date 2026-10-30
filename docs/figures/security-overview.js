// ─────────────────────────────────────────────────────────────
// security-overview.js - figure data for docs/reference/security/README.md,
// keyed by figure id (flat map; the page drops a figure in with a line like
// `@fig routes` or `@fig status`; this is the data behind that id). Edit the
// shape/labels here; edit the words in the .md.
// Grounded in src/core/archive.ts, src/core/regex/validate.ts + apply.ts,
// src/ui/_shared/render-markup.ts, src/sandbox/lua/*, src/ui/server-security.ts,
// docs/decisions/ADR-009-sandbox-origin.md.
// Kinds match docs/figures shapes: matrix = cols + rows[{ label, cells }].
// ─────────────────────────────────────────────────────────────

export default {
  // Each untrusted input meets ITS OWN gate. Nothing traverses all layers in series:
  // a zip hits archive caps, a regex hits the ReDoS gate, field text hits DOMPurify,
  // Lua and imported regex execute only through their supported sandbox actions.
  routes: {
    type: "matrix",
    fig: "fig 01",
    title: "each untrusted input, its own gate",
    caption:
      "bunzai does not funnel every input through one pipeline. Each kind of untrusted content meets " +
      "the gate built for it. Import and conversion keep scripts as data. Supported Lua and regex " +
      "execution requires an explicit action and its corresponding sandbox gate.",
    cols: ["Entry gate", "Handling", "Runs code?"],
    rows: [
      {
        label: "PNG / JSON card",
        cells: ["adapter detect + toCanonical", "scripts kept in escrow as data", { v: "no", hi: true }],
      },
      {
        label: "ZIP / charx / byaf",
        cells: ["unzipBounded caps", "bounded inflate, then parse", { v: "no", hi: true }],
      },
      {
        label: "Regex rule",
        cells: ["validation and construction bounds", "worker for imported execution; native calls not preemptible", { v: "explicit invocation", hi: true }],
      },
      {
        label: "Field markup",
        cells: ["200k input cap", "marked then DOMPurify, sanitize last", { v: "no", hi: true }],
      },
      {
        label: "Lua script",
        cells: ["Test Bench, explicit run", "hardened VM, worker kill, budgets", { v: "yes, sandboxed", hi: true }],
      },
    ],
  },

  // Source-level evidence and the remaining host-specific checks are separate.
  status: {
    type: "matrix",
    fig: "fig 02",
    title: "defense layers and their honest status",
    caption:
      "What each layer enforces, its code-layer evidence, and the remaining host-specific checks. " +
      "Distinct-origin isolation is tested at the HTTP layer; packaged " +
      "WebView2 verification remains unmeasured. Credential storage and diagnostic isolation have " +
      "code-level tests; native keychain behavior requires recorded platform results.",
    cols: ["Enforced in", "Code-layer suite", "Remaining host checks"],
    rows: [
      { label: "Parse, not execute", cells: ["core adapters + escrow", true, "not applicable"] },
      { label: "Archive caps", cells: ["core/archive.ts", true, "not applicable"] },
      { label: "ReDoS gate", cells: ["regex/validate.ts", true, "not applicable"] },
      { label: "Sanitized render", cells: ["ui/_shared render", true, "not applicable"] },
      { label: "Lua resource budgets", cells: ["sandbox/lua limits", true, "not applicable"] },
      { label: "Value-only wire", cells: ["sandbox/lua protocol", true, "not applicable"] },
      { label: "Loopback token gate", cells: ["ui/server-security", true, "not applicable"] },
      {
        label: "Distinct-origin isolation",
        cells: ["dual loopback listener", { v: "HTTP layer only", hi: true }, { lvl: 0, v: "packaged WebView isolation unmeasured" }],
      },
      {
        label: "BYOK key vault",
        cells: ["encrypted vault and OS backends", "unit / fake OS tools", { v: "native results required", hi: true }],
      },
    ],
  },
};
