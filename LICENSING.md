# Licensing

This project's source code is licensed under the **GNU Affero General Public License, version 3
or (at your option) any later version (AGPL-3.0-or-later)**. The full license text is in
[`LICENSE`](LICENSE). Files that carry separate license notices remain subject to those notices.

Copyright (C) 2026 Coneja-Chibi.

## Contributors

Thanks to the people whose work is part of this code, shared under the same license:

- **NemoVonNirgend**: regex, lorebook and atomic-file fixes.
- **Livingooal**: the backup archive import.
- **Luis** (GitHub: Hannd15): Kit tool-schema flattening.

## Optional Kit dependency

The Anthropic Claude Agent SDK is an optional dependency used by Kit's Claude subscription provider.
It is not bundled into the desktop release binary. Install it separately
(`bun add @anthropic-ai/claude-agent-sdk`) to use that provider. If it is unavailable, Kit reports
that the provider cannot be used; other Kit features remain available.

## Questions

Anything else, including if the AGPL does not fit what you want to build: chibiconeja@gmail.com
