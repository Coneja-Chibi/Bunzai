# Regex fixtures

## `risu-module-rows.json`

Constructed Risu customscript rows written for codec tests; no live module rows or source patterns
are included. Simple patterns retain coverage for `editrequest`, `editprocess`, `editdisplay`, the
malformed empty-string `disabled` value, a global flag, and `{{raw::...}}` replacement text. Separate
unit cases retain the `gu<cbs>` flag round-trip and phase conversion coverage. This fixture carries no
third-party license or attribution claim.
