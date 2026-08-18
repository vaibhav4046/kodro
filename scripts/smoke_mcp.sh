#!/usr/bin/env bash
#
# Smoke-test the Kodro MCP server on macOS and Linux.
#
# Thin wrapper around scripts/smoke_mcp.py. The protocol logic lives there and
# only there: a shell reimplementation and a PowerShell reimplementation would
# drift, and the one that drifted would be the one nobody ran.
#
# Usage:
#   ./scripts/smoke_mcp.sh                    # every entry point it can find
#   ./scripts/smoke_mcp.sh --entry module
#   ./scripts/smoke_mcp.sh --verbose
#
# Exit status is 0 only if every check passed on every entry point tried.

set -euo pipefail

# Resolve the repository root through any symlink on the script itself, so the
# wrapper works when it has been linked into a PATH directory.
source_path="${BASH_SOURCE[0]}"
while [ -L "$source_path" ]; do
  link_dir="$(cd -P "$(dirname "$source_path")" && pwd)"
  source_path="$(readlink "$source_path")"
  case "$source_path" in
    /*) ;;
    *) source_path="$link_dir/$source_path" ;;
  esac
done
script_dir="$(cd -P "$(dirname "$source_path")" && pwd)"
repo_root="$(dirname "$script_dir")"
driver="$script_dir/smoke_mcp.py"

if [ ! -f "$driver" ]; then
  echo "Cannot find $driver. Run this from a checkout of the Kodro repository." >&2
  exit 1
fi

# python3 first: on macOS and most distributions `python` is either absent or a
# Python 2 left over from a previous decade, and running the driver under it
# would fail with a syntax error that says nothing useful about the server.
python_bin=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then
    if "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
      python_bin="$candidate"
      break
    fi
  fi
done

if [ -z "$python_bin" ]; then
  echo "No Python 3.11 or newer interpreter found on PATH." >&2
  exit 1
fi

echo "Using $python_bin ($("$python_bin" --version 2>&1))"

cd "$repo_root"
exec "$python_bin" "$driver" "$@"
