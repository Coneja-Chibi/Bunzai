// ─────────────────────────────────────────────────────────────
// secrets-and-keys.js - figure data for
// docs/reference/security/secrets-and-keys.md, keyed by figure id
// (drop a figure in with a line like `@fig defenses`; this is the
// data behind that id). Edit the shape/labels here; edit the words
// in the .md.
// Grounded in src/ui/server-security.ts (checkApiRequest, the
// Host/Origin/token gate), src/ui/sandbox-host.ts (the distinct
// sandbox origin), docs/decisions/ADR-009-sandbox-origin.md (what
// is and is not measured), and src/kit/providers/vault.ts.
// The right column describes the available evidence:
// where each layer is actually proven.
// ─────────────────────────────────────────────────────────────

export default {
  defenses: {
    type: "matrix",
    fig: "fig 01",
    title: "each layer, and where it is proven",
    caption:
      "The loopback server and encrypted vault have automated source-level tests. Native keychain " +
      "behavior needs recorded platform results. Packaged WebView2 origin isolation remains " +
      "unmeasured; HTTP-layer evidence does not establish packaged isolation.",
    cols: ["Enforced by", "Proven where"],
    rows: [
      { label: "Loopback bind", cells: ["Bun.serve on 127.0.0.1 only", "Bun test"] },
      { label: "Host gate (/api/*)", cells: ["exact host:port, or a loopback alias on the same port", "Bun test"] },
      { label: "Mutation gate (POST)", cells: ["loopback Origin, plus a per-launch bearer via timingSafeEqual", "Bun test"] },
      { label: "Read gate (GET/HEAD)", cells: ["Host and browser same-origin/none metadata; CLI exception", "Bun test"] },
      { label: "Body caps", cells: ["streamed cap, 64MB inspect / 32MB JSON", "Bun test"] },
      { label: "Sandbox origin", cells: ["second ephemeral loopback listener, distinct origin", "Bun HTTP layer only"] },
      { label: "Packaged WebView isolation", cells: [{ v: "WebView2 runtime", hi: true }, { v: "NOT MEASURED, Plan 017 BLOCKED", hi: true }] },
      { label: "Key vault storage", cells: ["OS backend or local-key-file fallback; damaged reads refused", "unit tests / fake OS tools"] },
      { label: "Keychain diagnostic", cells: ["fresh probe-only service; cleanup failure reported", "isolated child-process tests"] },
    ],
  },
};
