#!/usr/bin/env bash
# Records RoleCall's prompt assembler on every fixture (see README.md).
# Usage: tools/rc-recorder/run.sh <path to a RoleCall checkout at the commit named by PIN in README.md>
set -euo pipefail
WT="${1:?worktree path}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REF="$(git -C "$WT" rev-parse HEAD)"
PIN="$(sed -n 's/^PIN=//p' "$HERE/README.md")"
[ "$REF" = "$PIN" ] || { echo "checkout is at $REF, the pin is $PIN" >&2; exit 1; }
DEST="$WT/__rc_recorder__"
rm -rf "$DEST" && mkdir -p "$DEST"
cp "$HERE/fake-supabase.ts" "$HERE/record.test.ts" "$HERE/record-macros.test.ts" "$DEST/"
cd "$WT/apps/rc"
RC_RECORDER_FIXTURES="$HERE/fixtures" RC_RECORDER_OUT="$HERE/recorded" RC_RECORDER_REF="$REF" \
  npx vitest run src/__rc_recorder__ --reporter=verbose
rm -rf "$DEST"
