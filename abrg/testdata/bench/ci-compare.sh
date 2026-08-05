#!/usr/bin/env bash
# Compare per-record match cost between two abrg binaries on the same runner.
# Both binaries run against this checkout's input, so hardware/runner speed
# cancels out. Fails when the PR binary is more than THRESHOLD times slower than
# the base binary.
#
# A cache carries the schema version of the binary that built it, so set
# BASE_CACHE to the fixture from the base checkout whenever the two sides differ
# on it. Unset, both sides read this checkout's fixture.
#
# Usage: ci-compare.sh <base-binary> <pr-binary>
set -euo pipefail

BASE_BIN=${1:?usage: ci-compare.sh <base-binary> <pr-binary>}
PR_BIN=${2:?usage: ci-compare.sh <base-binary> <pr-binary>}
THRESHOLD=${THRESHOLD:-1.15}
REPS=${REPS:-5}
BASE_CACHE=${BASE_CACHE:-}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

get() { printf '%s\n' "$1" | grep -oE "$2=[0-9.]+" | cut -d= -f2; }

echo "Measuring base binary ($REPS reps)..." >&2
base_line=$(BENCH_CACHE=$BASE_CACHE bash "$HERE/run.sh" "$BASE_BIN" "$REPS")
echo "Measuring PR binary ($REPS reps)..." >&2
pr_line=$(bash "$HERE/run.sh" "$PR_BIN" "$REPS")

base_mean=$(get "$base_line" mean_ms)
pr_mean=$(get "$pr_line" mean_ms)
ratio=$(awk -v p="$pr_mean" -v b="$base_mean" 'BEGIN{printf "%.3f", p/b}')
pct=$(awk -v p="$pr_mean" -v b="$base_mean" 'BEGIN{printf "%+.1f", (p/b-1)*100}')
limit_pct=$(awk -v t="$THRESHOLD" 'BEGIN{printf "%.0f", (t-1)*100}')
regressed=$(awk -v r="$ratio" -v t="$THRESHOLD" 'BEGIN{print (r>t)?1:0}')

verdict="within +${limit_pct}% budget"
[ "$regressed" = 1 ] && verdict="REGRESSION over +${limit_pct}%"

report=$(cat <<EOF
## abrg match per-record cost (duration_ms, GOMAXPROCS=1, min of ${REPS})

| binary | mean_ms | p50_ms | p90_ms | p99_ms |
|---|--:|--:|--:|--:|
| base | $(get "$base_line" mean_ms) | $(get "$base_line" p50_ms) | $(get "$base_line" p90_ms) | $(get "$base_line" p99_ms) |
| PR   | $(get "$pr_line" mean_ms) | $(get "$pr_line" p50_ms) | $(get "$pr_line" p90_ms) | $(get "$pr_line" p99_ms) |

PR/base mean = ${ratio}x (${pct}%) — ${verdict}
EOF
)

printf '%s\n' "$report"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && printf '%s\n' "$report" >> "$GITHUB_STEP_SUMMARY"

if [ "$regressed" = 1 ]; then
  echo "::error::abrg match per-record cost regressed ${pct}% (limit +${limit_pct}%)"
  exit 1
fi
