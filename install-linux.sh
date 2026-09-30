#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is missing. On Ubuntu: sudo apt install python3"
  exit 1
fi

exec python3 "$SCRIPT_DIR/mindmap_manager.py"
