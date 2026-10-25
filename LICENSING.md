<div align="center">

<img src="docs/media/hoplight-v.png" alt="" width="56">

<sub>· A CONEJA-CHIBI PRODUCTION ·</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/hoplight-wordmark-dark.png">
  <img src="docs/media/hoplight-wordmark-light.png" alt="Bunraku" width="320">
</picture>

</div>

---
# Licensing

Vaudeville Studios is free software under the **GNU AGPL-3.0-or-later**. The full text is in
[`LICENSE`](LICENSE).

Copyright (C) 2026 Coneja-Chibi.

## What that means in plain terms

**You can:** use it, read it, run it, change it, and share it. At home or at work. No fee, no
permission needed.

**You must:** keep it free. If you share vaud, or anything built from its code, the people you share
it with get the complete source under this same license. Keep the copyright notice and say what you
changed.

**You cannot:** take this code, close it up, and sell it as your own product.

That last line is the point of copyleft. It does not ban making money. It requires that the freedom
travels with the code.

## Contributors

Thanks to the people whose work is part of this code, shared under the same license:

- **NemoVonNirgend**: regex, lorebook and atomic-file fixes.
- **Livingooal**: the backup archive import.
- **Luis** (GitHub: Hannd15): Kit tool-schema flattening.

## Dependencies

Runtime dependencies are kept permissive on purpose, and `bun run license:audit` fails the build if a
copyleft or restricted dependency (AGPL, GPL, LGPL, SSPL, Elastic, BUSL, Commons Clause) sneaks in. It also fails on a proprietary production dependency ("SEE LICENSE IN", UNLICENSED, all rights
reserved). The one exception is Anthropic's Claude Agent SDK: it is an optional dependency, never bundled
into a release binary, and only needed for the Claude subscription provider in Kit. Install it yourself
(`bun add @anthropic-ai/claude-agent-sdk`) to use that provider; without it Kit says so and everything
else works.

## Questions

Anything else, including if the AGPL does not fit what you want to build: chibiconeja@gmail.com
