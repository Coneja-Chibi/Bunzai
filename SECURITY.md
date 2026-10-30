# Security Policy

## Reporting a vulnerability

Email **chibiconeja@gmail.com** with a description and, if you have one, a reproduction. Please
report privately before disclosing publicly.

What to expect:

- An acknowledgment within a few days
- A fix on Mainstage as fast as severity warrants
- Credit in the release notes if you want it

## Scope

Bunzai stores its library locally and provides a loopback Studio server and CLI. Remote access is
opt-in. Model providers, external tools, media links, updates, and connected services can involve
network requests. Reports most valuable here:

- Path escape from the studio folder (id validation, archive extraction)
- Anything that lets a web page reach the local API despite the token, Origin, and
  Sec-Fetch-Site checks
- Content-Security-Policy bypasses in the served shell
- Card payloads (Lua, macros, regex, archives) achieving execution or resource exhaustion
  despite the sealed-data rule and decompression caps
- Escapes from the test-bench sandbox: out of the wasmoon Lua VM, out of its worker, or off the
  sandbox origin (which serves only allowlisted worker assets and refuses `/api/*`)
- Corruption of user pieces despite atomic writes and escrow

Out of scope: issues requiring an attacker who already runs code on the same machine as the user.

## Posture

See the [security reference](docs/reference/security/README.md) for trust boundaries, implementation
references, and remaining verification limits. It distinguishes local and opt-in remote authority,
provider transmission, imported-script execution, credential storage, and sandbox/resource limits.

Source-level tests do not establish native keychain behavior or packaged WebView isolation. The
repository's workflows define the checks; consult their results for the specific commit rather than
assuming that every commit passed CI. Connected subprocesses and provider CLIs have their own
capabilities and network behavior. The model-usage ledger is not a complete network activity log.
