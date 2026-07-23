#!/usr/bin/env bash
# Measure abrg match per-record duration_ms against the bundled Tokyo cache.
#
# Aggregates the per-record result_info.duration_ms field, not wall-clock rate:
# duration_ms is the parallelism- and hardware-independent signal for code cost.
# Runs single-threaded (GOMAXPROCS=1) to remove memory-bandwidth contention noise
# and reports the fastest of REPS repetitions (least perturbed by the runner).
#
# Usage: run.sh <abrg-binary> [reps]
# Prints one machine-readable line: mean_ms=.. p50_ms=.. p90_ms=.. p99_ms=.. n=.. reps=..
set -euo pipefail

BIN=${1:?usage: run.sh <abrg-binary> [reps]}
REPS=${2:-3}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
INPUT=$HERE/tokyo.txt
CACHE=${BENCH_CACHE:-$HERE/../../../quickstart/tokyo_basic.duckdb}

test -x "$BIN" || { echo "ERROR: binary not executable: $BIN" >&2; exit 1; }
test -f "$INPUT" || { echo "ERROR: input not found: $INPUT" >&2; exit 1; }
test -f "$CACHE" || { echo "ERROR: cache not found: $CACHE" >&2; exit 1; }

best_mean="" best_line=""
for _ in $(seq "$REPS"); do
  out=$(mktemp)
  GOMAXPROCS=1 CACHE_PATH="$CACHE" "$BIN" match -q -i "$INPUT" -o "$out"
  line=$(grep -oE 'duration_ms":[0-9.]+' "$out" | cut -d: -f2 | sort -n | awk '
    {v[NR]=$1; s+=$1}
    END{n=NR; if(n==0){print "mean_ms=0 p50_ms=0 p90_ms=0 p99_ms=0 n=0"; exit}
        printf "mean_ms=%.4f p50_ms=%.4f p90_ms=%.4f p99_ms=%.4f n=%d",
          s/n, v[int(n*0.5)+1], v[int(n*0.9)+1], v[int(n*0.99)+1], n}')
  rm -f "$out"
  mean=${line#mean_ms=}; mean=${mean%% *}
  if [ -z "$best_mean" ] || awk "BEGIN{exit !($mean < $best_mean)}"; then
    best_mean=$mean; best_line=$line
  fi
done
echo "$best_line reps=$REPS"
