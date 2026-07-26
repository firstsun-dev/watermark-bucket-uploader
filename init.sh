#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

fail=0
note() { printf '\n=== %s ===\n' "$1"; }

note "npm install"
npm install || fail=1

note "npm run build"
npm run build || fail=1

note "npm test"
npm test || fail=1

note "npx eslint ."
npx eslint . || fail=1

note "harness hygiene"
if [ -f progress.md ]; then
  lines=$(wc -l < progress.md)
  if [ "$lines" -gt 80 ]; then
    echo "progress.md is ${lines} lines (>80) — archive done features to archive/$(date +%Y-%m).md as one-line entries and remove them from progress.md"
    fail=1
  fi
fi
if [ -f session-handoff.md ]; then
  sh_lines=$(wc -l < session-handoff.md)
  if [ "$sh_lines" -gt 150 ]; then
    echo "warning: session-handoff.md is ${sh_lines} lines (>150) — trim completed do-not-touch entries and stale sections"
  fi
fi

echo
if [ "$fail" -eq 0 ]; then echo "PASS"; else echo "FAIL"; fi
exit "$fail"