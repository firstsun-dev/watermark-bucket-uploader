#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

fail=0
note() { printf '\n=== %s ===\n' "$1"; }

note "pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile || fail=1

note "pnpm run build"
pnpm run build || fail=1

note "pnpm test"
pnpm test || fail=1

note "pnpm run lint --max-warnings=0"
pnpm run lint --max-warnings=0 || fail=1

echo
if [ "$fail" -eq 0 ]; then echo "PASS"; else echo "FAIL"; fi
exit "$fail"