---
id: reference/security/README
title: Security threat model and defense layers
audience: dev
summary: The assets bunraku protects, the untrusted inputs it faces, and each defense layer with its honest tested or scaffolded status.
tags: [security, threat-model, sandbox, redos, sanitization, byok, loopback]
related:
  - reference/architecture
  - decisions/ADR-006-ai-and-agent
  - decisions/ADR-009-sandbox-origin
---

# Security

bunraku ingests untrusted files (character cards with embedded scripts, PNG and ZIP payloads, regex rules,
Risu Lua) and holds the user's provider API keys. Security is a first-class story, so this page states
each defense and its honest status: what is enforced and covered by a code-layer suite, versus what is
scaffolded but not yet measured. Overclaiming in a security document is a defect worse than a gap. Where
a defense is proven at only one layer, that is said in the same breath.

## Threat model

**Assets.** The user's provider API keys and connection secrets; remote join secrets, device approvals,
and host-only controls; the local filesystem and the studio folder the user owns; the trusted UI origin
and its per-launch session token; the user's machine and its attention (availability).

**Adversary.** Content authored by someone else and opened by the user: a card whose fields carry
embedded scripts, a PNG or ZIP that may be a decompression bomb, a regex rule that may backtrack
catastrophically, a Risu Lua script. The usual transport is the user importing, editing, previewing, or
running that content. When the user explicitly enables Remote access, approved remote clients and the
remote listener become additional trust boundaries; see
[the remote-access threat model](remote-access.md). The primary Studio listener remains a local
loopback forge.

**Trust boundary.** Trust ends at every file and every request. Untrusted input is parsed once into the
canonical model, capabilities are denied by absence, and every gate fails closed. The two known-soft
edges are named explicitly below: packaged-host origin isolation is not yet measured (ADR-009), and
Kit's provider vault has shipped code but still has open recovery and non-Windows setup work.

@fig routes

## The layers

### 1. Parse, not execute

Every format converts through one canonical superset model, never format to format directly
(`docs/reference/architecture.md`). Import reads a file into that model; conversion is import then
export. A card's app-specific scripts, extension blocks, and layout are not first-class canonical
fields: they ride in the escrow envelope as opaque data (`docs/reference/architecture.md`). The
server evaluates nothing: scripts in entities are data, nothing is ever evaluated server-side
(the header comment of `src/ui/server.ts`).

Cross-format conversion is contained-loss by design. Only the canonical body crosses; one app's private
junk, including any executable payload, is deliberately not copied into another app's file. bunraku never
blind-copies one app's fields or executable payloads into another
(`docs/reference/architecture.md`). The adapter contract makes a cross-kind call unrepresentable,
so a lorebook can never be handed to a character writer (`docs/reference/architecture.md`).

Status: enforced by the adapter contract and the escrow envelope in `src/core`, and held by the
project-wide Round-Trip Law that same-format re-emit preserves semantic authored meaning. Byte identity
is required only for a format whose specification declares and fixtures prove a byte-level tier. This
layer covers import and conversion; the one place code does run is the Lua Test Bench, layer 5.

### 2. Decompression caps on archives

`src/core/archive.ts` inflates untrusted ZIP containers (charx, byaf, lumiverse, sprite packs) through
`unzipBounded`, which checks total entry count before selection, then checks selected compressed size,
original size, and aggregate size before inflation where fflate's filter allows, and rechecks actual
lengths after (`src/core/archive.ts`). Card containers cap at 96 MiB archive, 512 total entries,
64 MiB per selected entry, 96 MiB selected aggregate
(`src/core/archive.ts`); pack zips on import are 64 MiB in all, 256 entries, and 10 MiB per picture (`src/core/archive.ts`, `src/core/media/limits.ts`), a temporary limit until pack import streams.
A missing `originalSize` is treated as a lower bound, so a lying header still caps on compressed size
(`src/core/archive.ts`). Any breach throws `ArchiveLimitError`, and a required entry is never
silently dropped (`src/core/archive.ts`).

Status: enforced pre-inflate and post-inflate; suite at `src/core/archive.test.ts`.

### 3. ReDoS-guarded regex

A synchronous JS `RegExp` cannot be interrupted mid-execution, so the only real defense against
catastrophic backtracking is refusing the dangerous pattern before it ever compiles
(`src/core/regex/validate.ts`). `validateRule` is that gate: it rejects patterns over a complexity
hard cap of 50 and rejects AST shapes proven dangerous (nested unbounded quantifiers, overlapping
alternation under a star, quantified backreferences), returning the culprit span
(`src/core/regex/validate.ts`). `apply.ts` never runs a pattern this module rejects
(`src/core/regex/apply.ts`).

The engine adds a per-rule timeout (100ms default, 500ms max), a match cap of 1000, and a set-level time
budget (`src/core/regex/apply.ts`). Read the limit honestly: that timeout guards the
match loop between and around matches (`src/core/regex/apply.ts`). It cannot
interrupt a single pathological match inside one native `RegExp` call, which is exactly why the
pre-compile refusal in layer 3 is load-bearing, not the timeout.

`src/core/regex/ast/redos.ts` is a warning lens for the editor, tuned for precision over recall; it reads
structure and runs nothing, and it is not the gate (`src/core/regex/ast/redos.ts`).

Status: enforced by `validateRule` before compile plus the runtime budgets; suites at
`src/core/regex/validate.test.ts`, `apply.test.ts`, and `ast/redos.test.ts`.

### 4. Sanitized rendering

Stored field markup is rendered through marked then DOMPurify, sanitizing last, and the output goes
straight to `innerHTML` with no post-sanitize mutation (`src/ui/_shared/render-markup.ts`). Active,
form, embedding, and auto-fetch tags are forbidden outright (`script`, `iframe`, `object`, `embed`,
`form`, `img`, `video`, `style`, and more, `src/ui/_shared/render-markup.ts`); data attributes are
off; anchors are re-hardened with a scheme allowlist and `rel`/`target`; fetch attributes are stripped
from any survivor (`src/ui/_shared/render-markup.ts`).

The security decisions live in a pure, DOM-free policy so they are testable without a DOM
(`src/ui/_shared/render-policy.ts`): a 200k input cap, an http/https/mailto scheme allowlist, an inline-style property allowlist, and a value filter that blocks `url()`, `var()`,
`@import`, and `expression()` indirection. Sealed previews carry their own restrictive CSP as
the load-bearing egress barrier (`src/ui/_shared/render-policy.ts`); untrusted portrait bytes are
served with `content-security-policy: default-src 'none'; sandbox`, `nosniff`, and `cache-control:
no-store` (`src/ui/server-portrait.ts`) - decrypted art is plaintext, and
`no-cache` still lets Chrome and WebView2 write it to the browser's disk cache after revalidation.

Status: the pure policy has a suite at `src/ui/_shared/render-policy.test.ts`; the DOM half at
`render-markup.test.ts` runs client-side only.

### 5. The Lua sandbox and its resource budgets

Lua is the one untrusted input bunraku executes, and it runs only when the user opens the Risu Test Bench,
never automatically on import (`docs/decisions/ADR-009-sandbox-origin.md`).

**Capability by absence.** The wasmoon (PUC-Lua 5.4) engine opens no standard libraries by default and
loads only the pure set (base, table, string, math, coroutine, utf8), never io, os, debug, or package
(`src/sandbox/lua/engine.ts`). The bytecode and host-reaching base globals (`load`, `loadfile`,
`dofile`, `loadstring`, `require`, `collectgarbage`) are stripped after the libs open
(`src/sandbox/lua/engine.ts`). Anything not injected as a capability does not exist in
the card (`src/sandbox/lua/engine.ts`).

**Resource budgets.** Wall-clock timeout, Lua heap ceiling, source size, wire size, and per-field
host-state caps are typed and enforced (`src/sandbox/lua/limits.ts`). Release defaults are
a 5s deadline, a 64 MiB heap, 2 MiB source, and a 2 MiB host-state footprint
(`src/sandbox/lua/limits.ts`). Callers may request lower values for adversarial tests; higher
values are clamped to these ceilings and never trusted upward (`src/sandbox/lua/limits.ts`).

**The real kill switch.** Each run happens in a Worker with a hard wall-clock deadline; when it hits, the
worker is terminated (`src/sandbox/lua/run-in-worker.ts`). Source and wire state
are validated against budgets before `postMessage`, and the function never hangs or throws
(`src/sandbox/lua/run-in-worker.ts`).

**Value-only wire.** The parent-worker boundary is a versioned, value-only tagged union: JSON-like
primitives, arrays, and plain records only, with an allowlist of keys and an explicit forbidden-key set
covering token, cookie, authorization, and session spellings
(`src/sandbox/lua/protocol.ts`). Every received message is validated and fails closed;
functions, handles, non-plain prototypes, and `__proto__`/`constructor` keys are rejected
(`src/sandbox/lua/protocol.ts`). The per-launch API token never enters a message
(`src/sandbox/lua/run-in-worker.ts`).

Status: budgets, worker kill, and the value-only protocol have suites at `src/sandbox/lua/limits.test.ts`,
`run-in-worker.test.ts`, and `protocol.test.ts`. These run in Bun. What is not yet proven for this layer
is the packaged-host origin boundary, layer 6.

### 6. Distinct-origin sandbox isolation (packaged-host proof BLOCKED)

ADR-009 adds a defense-in-depth origin boundary: a second loopback listener on an ephemeral port serves
only the Lua worker, regex worker, and `glue.wasm`, with no `/api`, no session token, no index HTML, and
no studio paths (`docs/decisions/ADR-009-sandbox-origin.md`;
`src/ui/sandbox-host.ts`).
A same-origin Worker is an availability boundary, not an origin boundary, so this reduces blast radius if
a future engine, bundler, or WebView bug exposes web capabilities
(`docs/decisions/ADR-009-sandbox-origin.md`).

This is honest only when scoped. The origin separation is implemented and tested at the HTTP and handler
layer in Bun: the allowlist, the value-protocol reject cases, and token absence are automated
(`docs/decisions/ADR-009-sandbox-origin.md`). The packaged WebView2 origin probe,
`self.crossOriginIsolated` and storage visibility, and credentialed API fetch from the sandbox origin in
the installed host are not measured (`docs/decisions/ADR-009-sandbox-origin.md`). Plan 017 is
therefore BLOCKED for full Done criteria, and release notes must not claim full sandbox isolation
(`docs/decisions/ADR-009-sandbox-origin.md`).

If the sandbox listener fails to bind, the UI falls back to a same-origin worker on the primary server.
That mode is degraded and is explicitly not claimed isolated (`docs/decisions/ADR-009-sandbox-origin.md`;
`src/sandbox/lua/run-in-worker.ts`; `startUi` in `src/ui/server.ts`).

Status: HTTP-layer authority, allowlist, CSP, and CORS are automated; the packaged WebView2 origin proof
is not measured and remains BLOCKED.

### 7. Token-gated local server and opt-in remote access

The primary UI server binds `127.0.0.1` (`startUi` in `src/ui/server.ts`). Security lives in
`src/ui/server-security.ts`: a per-launch bearer token from `randomBytes(32)`
(`createSecurityContext` in `src/ui/server-security.ts`); a Host check on every `/api` method and an Origin plus token check on
every POST, compared with `timingSafeEqual` (`checkApiRequest`, `tokensEqual` in `src/ui/server-security.ts`). The
Host/Origin gate exists to stop DNS-rebinding from attacker hostnames
(`LOOPBACK_NAMES` in `src/ui/server-security.ts`). GET and HEAD cannot demand a token (an `<img src>` sends no headers),
so cross-site and same-site (another loopback port) requests are refused via the browser-set `Sec-Fetch-Site` header instead
(`refuseForeignRead`); a POST with a missing Origin fails closed
(`checkApiRequest`). Request bodies are capped (64 MiB inspect, 32 MiB JSON) with a
streaming reader that returns 413 on overflow (`INSPECT_BODY_MAX` and `readBodyCapped` in `src/ui/server-security.ts`, `JSON_BODY_MAX_BYTES` in `src/core/media/limits.ts`). Opening an
external link is POST-only, re-validated to http or https via `safeExternalUrl`, and spawned with an argv
array rather than a shell string (`openInBrowser` in `src/ui/server-security.ts`).

Remote tunnel and LAN modes are separate, explicitly enabled boundaries with their own join secret,
device approval, and host-only control routes. The tunnel additionally carries the one path that turns
a download into an executable: the mesh helper is not bundled, and fetching it is an explicit host-only
request verified against a committed SHA-256 before any bytes reach the path the spawner reads. Their
detailed threats and controls live in [the remote-access reference](remote-access.md).

Status: the primary listener is enforced in `server-security.ts`, extracted from the server so the
gate is unit testable; the security surface is re-exported for tests (`src/ui/server.ts`).
Remote access is opt-in and must not be generalized from the primary listener's loopback claim.

### 8. BYOK provider vault (shipping in Kit)

Kit stores provider configurations, including credentials, in one encrypted vault file
(`src/kit/providers/vault.ts`). The plaintext provider list exists only after the process opens the
vault. Writes seal the complete document, write a private temporary file, and atomically replace the
previous vault.

`src/kit/keystore/registry.ts` selects the first available sealing backend. Windows uses DPAPI when
available. A portable passphrase backend is implemented, and each sealed blob records the backend that
created it; opening consults that exact backend and does not silently try another one. The current Kit
settings flow does not yet collect or supply the passphrase, so non-Windows first-run setup and unlock
are incomplete.

Provider egress is constrained separately in `src/kit/providers/egress.ts`: the configured endpoint is
normalized and the initial request URL must match its host. The current fetch path does not revalidate
runtime redirects, so the gate is not an end-to-end redirect policy. Credentials authenticate to that
provider but are not inserted into model messages, tool observations, canonical pieces, exports,
transcripts, or the privacy ledger.

Status: encryption, backend selection, atomic replacement, provider resolution, and egress locking
ship with Kit and have focused suites under `src/kit/keystore` and `src/kit/providers`. The current
outer-file reader still treats malformed or unreadable envelope JSON as an absent vault before
decryption; recovery must be repaired before the vault is described as fully fail-closed.

## Status at a glance

@fig status

## What this document does not claim

- Not "fully isolated" or "fully sandboxed." The Lua origin boundary is proven at the HTTP layer, not in
  the packaged WebView2 host; that proof is BLOCKED (`docs/decisions/ADR-009-sandbox-origin.md`).
- Not "cannot be exploited" or "completely safe." These layers reduce blast radius and fail closed; they
  are defense in depth, not a proof of impossibility.
- The regex per-rule timeout does not interrupt a single catastrophic native `RegExp` match. The
  pre-compile refusal is the actual defense (`src/core/regex/validate.ts`).
- The provider vault does not yet have a complete malformed-envelope recovery path, and the release
  workflow ships `bunraku-kit-*` binaries with that gap still open.
- The portable vault backend does not yet have a settings-driven passphrase setup and unlock flow.
- Provider egress checks the initial configured host but does not revalidate runtime redirects.
- Where the sandbox listener cannot bind, the same-origin fallback is degraded and not isolated.
