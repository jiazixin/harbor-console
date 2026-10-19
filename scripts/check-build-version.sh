#!/bin/sh
# Starts a built harbor-console binary and checks the version and commit it
# reports in its server_started log line.
#
# Usage: scripts/check-build-version.sh <binary> <expected-version> <expected-commit>
set -eu

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <binary> <expected-version> <expected-commit>" >&2
  exit 2
fi

binary=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
want_version=$2
want_commit=$3

# Run from an empty directory so no local configs/config.local.yaml is read.
work_dir=$(mktemp -d)
log_file="$work_dir/server.log"
cleanup() {
  if [ -n "${server_pid:-}" ]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -rf "$work_dir"
}
trap cleanup EXIT

(cd "$work_dir" && exec env -u CONFIG_FILE LISTEN=127.0.0.1 PORT="${PORT:-18081}" LOG_FORMAT=json \
  "$binary" >"$log_file" 2>&1) &
server_pid=$!

attempt=0
until grep -q '"msg":"server_started"' "$log_file"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -gt 50 ] || ! kill -0 "$server_pid" 2>/dev/null; then
    echo "server did not start:" >&2
    cat "$log_file" >&2
    exit 1
  fi
  sleep 0.2
done

started=$(grep '"msg":"server_started"' "$log_file")
for expected in "\"version\":\"$want_version\"" "\"commit\":\"$want_commit\""; do
  case "$started" in
    *"$expected"*) ;;
    *)
      printf 'build metadata mismatch\n  want: %s\n  got:  %s\n' "$expected" "$started" >&2
      exit 1
      ;;
  esac
done
echo "$started"
