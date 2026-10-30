---
id: reference/security/README
title: Security threat model and defense layers
audience: dev
summary: Bunzai's trust boundaries, their authoritative implementation references, and the limits of current verification.
tags: [security, threat-model, sandbox, redos, sanitization, byok, loopback]
related:
  - reference/architecture
  - reference/security/archives
  - reference/security/regex-safety
  - reference/security/secrets-and-keys
  - reference/security/remote-access
  - decisions/ADR-009-sandbox-origin
---

# Security

Bunzai imports files from other people and stores provider credentials. Its defenses protect the
local library, credentials, API authority, and machine resources. They reduce risk; they do not
establish that the application cannot be exploited.

This page is an overview. The linked references own each boundary's detailed limits and evidence.

## Trust boundaries

Untrusted inputs include character cards, archives, markup, Lua, regex rules, model responses, and
remote requests. Imported scripts remain data during import and conversion. Execution requires a
supported action and its corresponding gate. Enabling an imported regex set for a scene is an
explicit invocation; importing the set is not.

The primary Studio listener binds to loopback. Remote access is a separate, opt-in authority with
its own authentication and host-only controls. A provider-backed turn sends the conversation and
requested observations to the configured provider; local storage does not make that request local.

@fig routes

| Boundary | Authoritative reference | What is enforced |
| --- | --- | --- |
| Import and conversion | [Architecture](../architecture.md), [escrow and round trips](../concepts/escrow-and-roundtrip.md) | Canonical adapters preserve source data without executing imported payloads. Same-format semantic fidelity is distinct from byte identity. |
| Archives | [Archive safety](archives.md) | Entry, size, and decompression checks. The reference distinguishes pre-allocation limits, post-inflate checks, and exported entry-name residuals. |
| Regex | [Regex safety](regex-safety.md) | Validation after find-side substitution, conservative AST refusal, construction/output limits, and isolated workers for imported execution. Native synchronous calls have no hard preemption guarantee. |
| Markup and previews | [Safe rendering](safe-rendering.md) | Sanitization, URL/style restrictions, preview policy, and explicit browser/packaged-host verification limits. |
| Lua | [Script sandbox](script-sandbox.md) | Restricted capabilities, value-only messages, memory/state limits, and a terminable worker. |
| Local API | [Secrets and keys](secrets-and-keys.md) | Host and Origin checks, per-launch mutation bearer, foreign-page read refusal, and bounded request bodies. A local process can obtain the loopback shell's bearer. |
| Remote access | [Remote-access threat model](remote-access.md) | Explicit enablement, join/device approval, host-only controls, bounded LAN authentication work, and verified helper downloads. |
| Provider credentials | [Secrets and keys](secrets-and-keys.md) | Encrypted vault, backend-tagged decryption, atomic verified writes, and refusal of damaged reads before they become empty state. |
| Guarded HTTP provider requests | [Secrets and keys](secrets-and-keys.md) | Configured-host checks on every redirect hop, scheme restrictions, and HTTPS downgrade refusal. External provider CLIs and connected subprocesses have separate network behavior. |

## Evidence and remaining limits

@fig status

Code-level tests cover these boundaries. A passing source test is not proof of the packaged host,
real OS-keychain behavior, or every external provider. The reference for each boundary names the
corresponding tests and unverified cases.

- **Packaged origin isolation remains unmeasured.** The second loopback sandbox origin is tested at
  the HTTP/handler layer. WebView2 storage visibility and credentialed API access from the packaged
  sandbox have not been measured. A same-origin worker fallback is degraded, not isolated
  ([ADR-009](../../decisions/ADR-009-sandbox-origin.md)).
- **Native regex matching is not interruptible.** Static refusal and construction bounds reduce
  risk. Checks around a native call cannot stop it mid-match. Imported regex execution uses its
  isolated worker; the exact scope is documented in [regex safety](regex-safety.md).
- **Local-key-file protection is weaker than OS key storage.** A reader who obtains both that key
  file and its vault can decrypt the vault. The passphrase backend has no settings-driven unlock
  flow. These are explicit [credential-storage limits](secrets-and-keys.md).
- **Damaged credentials are preserved.** Only a missing vault reads as empty. Other file, envelope,
  and plaintext-shape failures reject reads and subsequent saves. The narrow damaged-identity-file
  recovery preserves both original files and reports the incident. This does not establish
  cross-process write-conflict safety or change the decrypted cache lifecycle.
- **Diagnostic isolation is separate from native proof.** The keychain probe uses a fresh
  probe-only service and cleans only its own entries. Isolated child-process regressions preserve
  planted application credentials and cover failed cleanup; real macOS/Linux verification belongs
  to recorded runs of the configured CI job.
